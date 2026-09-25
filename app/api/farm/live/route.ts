import { NextRequest, NextResponse } from "next/server";
import type {
  FarmLiveAnimal, FarmLiveFruit, FarmLiveLookupResponse, FarmLiveProduction, FarmLiveResourceGroup, FarmLiveSnapshot,
} from "../../../../lib/farm/liveData";
import { crops as cropDefinitions } from "../../../../lib/gameData";
import { calculateEffectiveDuration, summarizeDetectedBoosts, type BoostContext } from "../../../../lib/farm/boostEngine";

type UnknownRecord = Record<string, unknown>;

const SFL_COMMUNITY_FARM_API = "https://api.sunflower-land.com/community/farms";

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}


function readXY(...records: UnknownRecord[]): { x?: number; y?: number } {
  for (const record of records) {
    const directX = asNumber(record.x); const directY = asNumber(record.y);
    if (directX !== undefined && directY !== undefined) return { x: directX, y: directY };
    const coordinates = asRecord(record.coordinates);
    const cx = asNumber(coordinates.x); const cy = asNumber(coordinates.y);
    if (cx !== undefined && cy !== undefined) return { x: cx, y: cy };
    const position = asRecord(record.position);
    const px = asNumber(position.x); const py = asNumber(position.y);
    if (px !== undefined && py !== undefined) return { x: px, y: py };
  }
  return {};
}

function collectStrings(value: unknown, out = new Set<string>(), depth = 0): Set<string> {
  if (depth > 5 || value == null) return out;
  if (typeof value === "string") { if (value.trim()) out.add(value.trim().toLowerCase()); return out; }
  if (Array.isArray(value)) { value.forEach((item) => collectStrings(item, out, depth + 1)); return out; }
  const record = asRecord(value);
  for (const [key, child] of Object.entries(record)) {
    if (child === true || (typeof child === "number" && child > 0)) out.add(key.toLowerCase());
    collectStrings(child, out, depth + 1);
  }
  return out;
}

function buildBoostContext(farm: UnknownRecord): BoostContext {
  const bumpkin = asRecord(farm.bumpkin);
  const collectibleNames = new Set<string>();
  const placements: BoostContext["placements"] = [];
  const collectibleRoots = [asRecord(farm.collectibles), asRecord(asRecord(farm.home).collectibles)];

  for (const root of collectibleRoots) {
    for (const [name, raw] of Object.entries(root)) {
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      if (!list.length) continue;
      collectibleNames.add(name.toLowerCase());
      list.forEach((entry) => {
        const record = asRecord(entry);
        const { x, y } = readXY(record);
        const placedAt = firstTimestamp(record, ["placedAt", "createdAt", "mintedAt"]);
        placements.push({ name, x, y, placedAt });
      });
    }
  }

  const wearableNames = collectStrings(bumpkin.equipped ?? bumpkin.wearables ?? bumpkin.clothing);
  const skillNames = new Set<string>();
  const skills = asRecord(bumpkin.skills);
  for (const [name, value] of Object.entries(skills)) {
    if (value === true || (typeof value === "number" && value > 0) || (typeof value === "string" && value !== "0" && value !== "false")) {
      skillNames.add(name.toLowerCase());
    }
  }

  return { collectibleNames, wearableNames, skillNames, placements };
}

function objectCount(value: unknown): number {
  return Object.keys(asRecord(value)).length;
}


function countPlacedCollectibles(value: unknown): number {
  const collectibles = asRecord(value);
  return Object.values(collectibles).reduce<number>((total, placed) => {
    if (Array.isArray(placed)) return total + placed.length;
    return total;
  }, 0);
}


function parsePlacedCollectibles(farm: UnknownRecord, boosts: BoostContext) {
  const counts = new Map<string, { name: string; farm: number; home: number }>();
  const roots: Array<["farm" | "home", UnknownRecord]> = [
    ["farm", asRecord(farm.collectibles)],
    ["home", asRecord(asRecord(farm.home).collectibles)],
  ];
  for (const [area, root] of roots) {
    for (const [name, raw] of Object.entries(root)) {
      const count = Array.isArray(raw) ? raw.length : raw ? 1 : 0;
      if (!count) continue;
      const key = name.toLowerCase();
      const row = counts.get(key) ?? { name, farm: 0, home: 0 };
      row[area] += count;
      counts.set(key, row);
    }
  }
  const known = new Set(summarizeDetectedBoosts(boosts).filter((b) => b.source === "collectible" && b.applied).map((b) => b.name.toLowerCase()));
  return [...counts.values()].map((row) => ({
    name: row.name, count: row.farm + row.home,
    area: (row.farm && row.home ? "both" : row.home ? "home" : "farm") as "farm" | "home" | "both",
    boostKnown: known.has(row.name.toLowerCase()),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

function countBuildings(value: unknown): number {
  const buildings = asRecord(value);
  return Object.values(buildings).reduce<number>((total, group) => {
    if (Array.isArray(group)) return total + group.length;
    return total;
  }, 0);
}

function parseInventory(value: unknown) {
  return Object.entries(asRecord(value))
    .map(([name, amount]) => ({ name, amount: asNumber(amount) ?? 0 }))
    .filter((item) => item.amount !== 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 120);
}

function normalizeTimestamp(value: unknown): number | undefined {
  const n = asNumber(value);
  if (n === undefined) return undefined;
  return n < 10_000_000_000 ? n * 1000 : n;
}

function firstTimestamp(record: UnknownRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = normalizeTimestamp(record[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

const cropGrowMs = new Map<string, number>((cropDefinitions as Array<{ name: string; growTimeSeconds: number }>).map((crop) => [crop.name.toLowerCase(), crop.growTimeSeconds * 1000]));

// Current base replenish times published by Sunflower Land. Explicit timestamps from
// the Farm API always take priority over these fallbacks.
const FRUIT_REPLENISH_MS: Record<string, number> = {
  tomato: 2 * 60 * 60 * 1000,
  lemon: 4 * 60 * 60 * 1000,
  chestnut: 4 * 60 * 60 * 1000,
  blueberry: 6 * 60 * 60 * 1000,
  starfruit: 6 * 60 * 60 * 1000,
  orange: 8 * 60 * 60 * 1000,
  apple: 12 * 60 * 60 * 1000,
  banana: 12 * 60 * 60 * 1000,
  coconut: 12 * 60 * 60 * 1000,
};

const RESOURCE_REPLENISH_MS: Record<string, number> = {
  trees: 2 * 60 * 60 * 1000,
  stones: 4 * 60 * 60 * 1000,
  iron: 8 * 60 * 60 * 1000,
  gold: 24 * 60 * 60 * 1000,
  crimstones: 24 * 60 * 60 * 1000,
  sunstones: 72 * 60 * 60 * 1000,
  oilReserves: 20 * 60 * 60 * 1000,
};

function parseCrops(value: unknown, boosts: BoostContext) {
  return Object.entries(asRecord(value)).flatMap(([id, plot]) => {
    const crop = asRecord(asRecord(plot).crop);
    const name = typeof crop.name === "string" ? crop.name : "";
    if (!name) return [];
    const plantedAt = normalizeTimestamp(crop.plantedAt);
    const harvestedAt = firstTimestamp(crop, ["harvestedAt", "removedAt", "collectedAt"]);
    if (harvestedAt && (!plantedAt || harvestedAt >= plantedAt)) return [];
    const explicitReady = firstTimestamp(crop, ["readyAt", "harvestAt", "grownAt", "endsAt"]);
    const growMs = cropGrowMs.get(name.toLowerCase());
    const { x, y } = readXY(asRecord(plot), crop);
    const timing = growMs ? calculateEffectiveDuration(growMs, { category: "crop", name, x, y, startedAt: plantedAt }, boosts) : undefined;
    const effective = timing?.effectiveDurationMs ?? growMs;
    return [{
      id, name, amount: asNumber(crop.amount) ?? 0, plantedAt,
      readyAt: explicitReady ?? (plantedAt && effective ? plantedAt + effective : undefined),
      baseDurationMs: growMs, effectiveDurationMs: effective,
      boostLabels: timing?.boosts.map((boost) => `${boost.name} ×${boost.factor.toFixed(2)}`),
    }];
  }).slice(0, 250);
}

function hasCoordinates(record: UnknownRecord): boolean {
  const direct = asNumber(record.x) !== undefined && asNumber(record.y) !== undefined;
  const coordinates = asRecord(record.coordinates);
  const position = asRecord(record.position);
  return direct ||
    (asNumber(coordinates.x) !== undefined && asNumber(coordinates.y) !== undefined) ||
    (asNumber(position.x) !== undefined && asNumber(position.y) !== undefined);
}

function isRemoved(record: UnknownRecord): boolean {
  return Boolean(
    firstTimestamp(record, ["removedAt", "deletedAt", "destroyedAt"]) ||
    record.removed === true || record.deleted === true || record.active === false
  );
}

function collectFruitRecords(value: unknown, path = "fruitPatches", depth = 0): Array<{ id: string; patch: UnknownRecord }> {
  if (depth > 6) return [];
  const record = asRecord(value);
  const out: Array<{ id: string; patch: UnknownRecord }> = [];

  for (const [key, raw] of Object.entries(record)) {
    if (Array.isArray(raw)) {
      raw.forEach((entry, index) => {
        const child = asRecord(entry);
        if (Object.keys(child).length) {
          out.push(...collectFruitRecords({ [`${key}-${index}`]: child }, `${path}.${key}`, depth + 1));
        }
      });
      continue;
    }

    const patch = asRecord(raw);
    if (!Object.keys(patch).length) continue;

    const fruit = asRecord(patch.fruit);
    const hasFruitSlot = "fruit" in patch;
    const hasFruitName = typeof fruit.name === "string" || typeof patch.name === "string";
    const looksLikePhysicalPatch = hasCoordinates(patch) || hasCoordinates(fruit);

    // Fruit patches remain in the save even while empty/replenishing. Do not require
    // fruit.name here or we only count patches that currently contain a named fruit.
    if (hasFruitSlot || hasFruitName || looksLikePhysicalPatch) {
      out.push({ id: path === "fruitPatches" ? key : `${path}.${key}`, patch });
      continue;
    }

    out.push(...collectFruitRecords(patch, `${path}.${key}`, depth + 1));
  }
  return out;
}

function primitiveDiagnostics(...records: UnknownRecord[]): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const record of records) {
    for (const [field, value] of Object.entries(record)) {
      if (!["string", "number", "boolean"].includes(typeof value)) continue;
      const line = `${field}=${String(value)}`;
      if (seen.has(line)) continue;
      seen.add(line);
      lines.push(line);
      if (lines.length >= 24) return lines;
    }
  }
  return lines;
}

function parseFruits(value: unknown, boosts: BoostContext): FarmLiveFruit[] {
  return collectFruitRecords(value).flatMap(({ id, patch }) => {
    const p = asRecord(patch);
    if (isRemoved(p)) return [];
    const fruit = asRecord(p.fruit);
    if (isRemoved(fruit)) return [];

    const explicitName = typeof fruit.name === "string"
      ? fruit.name
      : typeof p.name === "string"
        ? p.name
        : "Fruit Patch";

    const plantedAt = firstTimestamp(fruit, ["plantedAt", "startedAt", "planted"])
      ?? firstTimestamp(p, ["plantedAt", "startedAt", "planted"]);

    const explicitReady = firstTimestamp(fruit, [
      "readyAt", "harvestAt", "grownAt", "endsAt", "replenishesAt", "replenishAt",
      "regeneratesAt", "regenerateAt", "availableAt", "nextHarvestAt", "nextFruitAt",
    ]) ?? firstTimestamp(p, [
      "readyAt", "harvestAt", "grownAt", "endsAt", "replenishesAt", "replenishAt",
      "regeneratesAt", "regenerateAt", "availableAt", "nextHarvestAt", "nextFruitAt",
    ]);

    const harvestedAt = firstTimestamp(fruit, ["harvestedAt", "collectedAt", "pickedAt"])
      ?? firstTimestamp(p, ["harvestedAt", "collectedAt", "pickedAt"]);

    // The Community API commonly exposes the last harvest rather than the next
    // ready timestamp. In that case, derive the next harvest from the published
    // base replenish time for that fruit.
    const apiCooldown = durationMs(fruit) ?? durationMs(p);
    const baseCooldown = FRUIT_REPLENISH_MS[explicitName.toLowerCase()];
    const rawCooldown = apiCooldown ?? baseCooldown;
    const cycleStartedAt = harvestedAt ?? plantedAt;
    const { x, y } = readXY(p, fruit);
    const timing = rawCooldown ? calculateEffectiveDuration(rawCooldown, { category: "fruit", name: explicitName, x, y, startedAt: cycleStartedAt }, boosts) : undefined;
    const cooldown = timing?.effectiveDurationMs ?? rawCooldown;
    const readyAt = explicitReady ?? (cycleStartedAt !== undefined && cooldown !== undefined ? cycleStartedAt + cooldown : undefined);
    const harvestsLeft = asNumber(fruit.harvestsLeft) ?? asNumber(p.harvestsLeft);

    const hasNamedFruit = explicitName !== "Fruit Patch";
    let status: FarmLiveFruit["status"] = "unknown";
    if (!hasNamedFruit && !readyAt) status = "empty";
    else if (harvestsLeft === 0 && !readyAt) status = "empty";
    else if (readyAt !== undefined) status = readyAt <= Date.now() ? "ready" : "growing";

    return [{
      id,
      name: explicitName,
      plantedAt,
      readyAt,
      harvestsLeft,
      status,
      baseDurationMs: rawCooldown,
      effectiveDurationMs: cooldown,
      boostLabels: timing?.boosts.map((boost) => `${boost.name} ×${boost.factor.toFixed(2)}`),
      diagnosticFields: primitiveDiagnostics(fruit, p),
    } as FarmLiveFruit];
  }).slice(0, 250);
}

function durationMs(record: UnknownRecord): number | undefined {
  const millisecondKeys = ["cooldownMs", "recoveryMs", "replenishMs", "regenMs", "durationMs"];
  for (const key of millisecondKeys) {
    const value = asNumber(record[key]);
    if (value !== undefined && value > 0) return value;
  }
  const secondKeys = ["cooldownSeconds", "recoverySeconds", "replenishSeconds", "regenSeconds", "durationSeconds", "cooldown", "recoveryTime", "replenishTime", "regenTime"];
  for (const key of secondKeys) {
    const value = asNumber(record[key]);
    if (value !== undefined && value > 0) return value > 10_000_000 ? value : value * 1000;
  }
  return undefined;
}

function derivedResourceTiming(node: UnknownRecord, resource: UnknownRecord, groupKey: string, boosts: BoostContext) {
  const explicit = firstTimestamp(resource, ["readyAt", "regeneratesAt", "replenishesAt", "availableAt", "endsAt", "recoversAt"])
    ?? firstTimestamp(node, ["readyAt", "regeneratesAt", "replenishesAt", "availableAt", "endsAt", "recoversAt"]);

  const actionKeys = groupKey === "trees"
    ? ["choppedAt", "cutAt", "collectedAt", "harvestedAt"]
    : ["minedAt", "collectedAt", "harvestedAt", "usedAt"];
  const lastAction = firstTimestamp(resource, actionKeys) ?? firstTimestamp(node, actionKeys);
  const apiCooldown = durationMs(resource) ?? durationMs(node);
  const baseCooldown = RESOURCE_REPLENISH_MS[groupKey];
  const rawCooldown = apiCooldown ?? baseCooldown;
  const { x, y } = readXY(node, resource);
  const timing = rawCooldown ? calculateEffectiveDuration(rawCooldown, {
    category: groupKey === "trees" ? "tree" : "mineral",
    name: groupKey, x, y, startedAt: lastAction,
  }, boosts) : undefined;
  const effective = timing?.effectiveDurationMs ?? rawCooldown;
  return {
    readyAt: explicit ?? (lastAction !== undefined && effective !== undefined ? lastAction + effective : undefined),
    baseDurationMs: rawCooldown,
    effectiveDurationMs: effective,
    boostLabels: timing?.boosts.map((boost) => `${boost.name} ×${boost.factor.toFixed(2)}`),
  };
}

function isPlacedResourceNode(node: UnknownRecord, resource: UnknownRecord): boolean {
  if (isRemoved(node) || isRemoved(resource)) return false;

  // A node with coordinates is physically placed on the current farm map.
  if (hasCoordinates(node) || hasCoordinates(resource)) return true;

  // Some Community API versions omit coordinates but expose a concrete live-state object.
  const stateKeys = [
    "minedAt", "choppedAt", "readyAt", "regeneratesAt", "replenishesAt", "availableAt",
    "amount", "health", "usesLeft", "hitsLeft", "cooldownSeconds", "recoverySeconds",
  ];
  return stateKeys.some((key) => node[key] !== undefined || resource[key] !== undefined);
}

function parseResources(farm: UnknownRecord, boosts: BoostContext): FarmLiveResourceGroup[] {
  const groups: Array<{ key: string; label: string; nodeKey: string }> = [
    { key: "trees", label: "Árvores", nodeKey: "wood" }, { key: "stones", label: "Pedras", nodeKey: "stone" },
    { key: "iron", label: "Ferro", nodeKey: "stone" }, { key: "gold", label: "Ouro", nodeKey: "stone" },
    { key: "crimstones", label: "Crimstone", nodeKey: "stone" }, { key: "sunstones", label: "Sunstone", nodeKey: "stone" },
    { key: "oilReserves", label: "Óleo", nodeKey: "oil" },
  ];
  return groups.map(({ key, label, nodeKey }) => {
    const nodes = asRecord(farm[key]);
    const parsed = Object.entries(nodes).flatMap(([id, node]) => {
      const n = asRecord(node);
      const resource = asRecord(n[nodeKey]);
      if (!isPlacedResourceNode(n, resource)) return [];

      const timing = derivedResourceTiming(n, resource, key, boosts);
      const readyAt = timing.readyAt;
      const status: "ready" | "recovering" | "unknown" = readyAt
        ? (readyAt <= Date.now() ? "ready" : "recovering")
        : "unknown";
      const diagnosticFields = primitiveDiagnostics(resource, n);
      return [{ id, group: key, label, readyAt, status, baseDurationMs: timing.baseDurationMs, effectiveDurationMs: timing.effectiveDurationMs, boostLabels: timing.boostLabels, diagnosticFields: diagnosticFields.length ? diagnosticFields : undefined }];
    });
    return { key, label, totalNodes: parsed.length, activeNodes: parsed.filter((n) => n.status === "ready").length, nodes: parsed };
  }).filter((group) => group.totalNodes > 0);
}

function parseProductions(buildingsValue: unknown, boosts: BoostContext): FarmLiveProduction[] {
  const out: FarmLiveProduction[] = [];
  for (const [building, entries] of Object.entries(asRecord(buildingsValue))) {
    const list = Array.isArray(entries) ? entries : Object.values(asRecord(entries));
    list.forEach((entry, buildingIndex) => {
      const b = asRecord(entry);
      const queues = [b.crafting, b.cooking, b.queue, b.production, b.craftingItems, b.cookingItems].flatMap((v) => Array.isArray(v) ? v : v ? [v] : []);
      queues.forEach((q, index) => {
        const r = asRecord(q);
        const item = String(r.name ?? r.item ?? r.recipe ?? r.craft ?? "Produção");
        const explicitReady = firstTimestamp(r, ["readyAt", "craftedAt", "cookedAt", "endsAt", "completeAt", "finishesAt"]);
        const startedAt = firstTimestamp(r, ["startedAt", "cookingStartedAt", "craftedAt", "createdAt"]);
        const rawDuration = durationMs(r) ?? (explicitReady !== undefined && startedAt !== undefined && explicitReady > startedAt ? explicitReady - startedAt : undefined);
        const timing = rawDuration ? calculateEffectiveDuration(rawDuration, { category: "cooking", name: item, startedAt }, boosts) : undefined;
        const readyAt = explicitReady ?? (startedAt !== undefined && timing ? startedAt + timing.effectiveDurationMs : undefined);
        out.push({ id: `${building}-${buildingIndex}-${index}`, building, item, readyAt, status: readyAt ? (readyAt <= Date.now() ? "ready" : "cooking") : "unknown", baseDurationMs: rawDuration, effectiveDurationMs: timing?.effectiveDurationMs ?? rawDuration, boostLabels: timing?.boosts.map((boost) => `${boost.name} ×${boost.factor.toFixed(2)}`) });
      });
    });
  }
  return out.slice(0, 100);
}

function flattenAnimalDiagnostics(value: unknown, path = "", depth = 0, out: Array<{ path: string; value: string }> = []) {
  if (depth > 6 || out.length >= 120 || value == null) return out;
  if (["string", "number", "boolean"].includes(typeof value)) {
    const p = path || "value";
    if (/level|xp|experience|sleep|wake|ready|egg|feather|wool|milk|leather|food|feed|grain|buff|boost|yield|produce|reward|request|affection|love|pet|mim|cycle|round|fed|hungry|state|status/i.test(p)) {
      out.push({ path: p, value: String(value) });
    }
    return out;
  }
  if (Array.isArray(value)) {
    value.slice(0, 25).forEach((child, index) => flattenAnimalDiagnostics(child, `${path}[${index}]`, depth + 1, out));
    return out;
  }
  const record = asRecord(value);
  for (const [key, child] of Object.entries(record)) {
    const next = path ? `${path}.${key}` : key;
    flattenAnimalDiagnostics(child, next, depth + 1, out);
    if (out.length >= 120) break;
  }
  return out;
}

function inferAnimalKind(a: UnknownRecord, fallback: string) {
  const candidates = [a.type, a.animalType, a.species, a.kind];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function parseAnimalCollection(value: unknown, kind: string): FarmLiveAnimal[] {
  return Object.entries(asRecord(value)).map(([id, animal]) => {
    const a = asRecord(animal);
    const sickUntil = firstTimestamp(a, ["sickUntil", "recoversAt", "healthyAt"]);
    const asleepUntil = firstTimestamp(a, ["awakeAt", "wakesAt", "sleepUntil"]);
    const readyAt = firstTimestamp(a, ["readyAt", "harvestAt", "producesAt", "fedAt"]);
    // Different animal versions have used different names for the affection/petting timer.
    // We accept only explicit future/ready timestamps here; last-action timestamps are kept
    // in diagnostics until their cooldown rule is confirmed.
    const affectionCandidates = [
      "affectionReadyAt", "nextAffectionAt", "petReadyAt", "nextPetAt",
      "loveReadyAt", "nextLoveAt", "cuddleReadyAt", "nextCuddleAt",
      "strokeReadyAt", "nextStrokeAt", "mimoReadyAt", "nextMimoAt",
    ];
    const affectionAt = firstTimestamp(a, affectionCandidates);
    const diagnosticFields = Object.entries(a)
      .filter(([key, value]) => /pet|love|affection|cuddle|stroke|mim|hug|happy/i.test(key) && (typeof value === "number" || typeof value === "string"))
      .map(([key, value]) => `${key}=${String(value)}`)
      .slice(0, 8);
    // Keep buff/feed-related primitives visible for diagnostics. We intentionally do not
    // assign game semantics until a field/recipe has been verified against current data.
    const buffFields = Object.entries(a)
      .filter(([key, value]) => /buff|boost|feed|food|fed|yield|produce|harvest|level|experience|xp|cycle|round/i.test(key) && (typeof value === "number" || typeof value === "string" || typeof value === "boolean"))
      .map(([key, value]) => `${key}=${String(value)}`)
      .slice(0, 16);
    const apiDiagnosticFields = flattenAnimalDiagnostics(a);
    const nestedLevel = apiDiagnosticFields.find((entry) => /(^|\.)(level|animalLevel)$/i.test(entry.path));
    const level = asNumber(a.level) ?? asNumber(a.animalLevel) ?? asNumber(nestedLevel?.value);
    const resolvedKind = inferAnimalKind(a, kind);
    const explicitState = String(a.state ?? a.status ?? "").toLowerCase();
    let state: FarmLiveAnimal["state"] = "unknown";
    if (sickUntil && sickUntil > Date.now() || explicitState.includes("sick")) state = "sick";
    else if (asleepUntil && asleepUntil > Date.now() || explicitState.includes("sleep")) state = "sleeping";
    else if (explicitState.includes("hungry") || explicitState.includes("attention")) state = "needs_attention";
    else if (Object.keys(a).length) state = "awake";
    return {
      id, kind: resolvedKind, name: typeof a.name === "string" ? a.name : undefined, state,
      readyAt: sickUntil ?? asleepUntil ?? readyAt,
      affectionAt, affectionLabel: affectionAt ? "Próximo mimo" : undefined,
      diagnosticFields: diagnosticFields.length ? diagnosticFields : undefined,
      buffFields: buffFields.length ? buffFields : undefined,
      apiDiagnosticFields: apiDiagnosticFields.length ? apiDiagnosticFields : undefined,
      rawData: a, level,
      note: explicitState || undefined,
    };
  });
}

function parseAnimals(farm: UnknownRecord): FarmLiveAnimal[] {
  const henHouse = asRecord(farm.henHouse); const barn = asRecord(farm.barn);
  return [...parseAnimalCollection(henHouse.animals, "Chicken"), ...parseAnimalCollection(barn.animals, "Barn")].slice(0, 150);
}

function buildSnapshot(farmId: string, payload: unknown): FarmLiveSnapshot {
  const root = asRecord(payload);
  const farm = asRecord(root.farm);
  const bumpkin = asRecord(farm.bumpkin);
  const boostContext = buildBoostContext(farm);
  const crops = parseCrops(farm.crops, boostContext);
  const fruits = parseFruits(farm.fruitPatches, boostContext);
  const inventory = parseInventory(farm.inventory ?? root.inventory);
  const henHouse = asRecord(farm.henHouse);
  const barn = asRecord(farm.barn);
  const resources = parseResources(farm, boostContext);
  const productions = parseProductions(farm.buildings, boostContext);
  const animals = parseAnimals(farm);
  const collectibles = parsePlacedCollectibles(farm, boostContext);

  return {
    farmId,
    provider: "Sunflower Land Community Farm API",
    fetchedAt: Date.now(),
    bumpkin: {
      name: typeof bumpkin.name === "string" ? bumpkin.name : undefined,
      experience: asNumber(bumpkin.experience),
    },
    summary: {
      cropPlots: objectCount(farm.crops),
      plantedCrops: crops.length,
      fruitPatches: fruits.length,
      chickens: objectCount(henHouse.animals),
      barnAnimals: objectCount(barn.animals),
      buildings: countBuildings(farm.buildings),
      collectibles:
        countPlacedCollectibles(farm.collectibles) +
        countPlacedCollectibles(asRecord(farm.home).collectibles),
      inventoryItems: inventory.length,
      activeTrades: objectCount(farm.trades),
      readyCrops: crops.filter((crop) => crop.readyAt !== undefined && crop.readyAt <= Date.now()).length,
      readyResources: resources.flatMap((group) => group.nodes).filter((node) => node.status === "ready").length,
      activeProductions: productions.length,
      animalsNeedingAttention: animals.filter((animal) => animal.state === "sick" || animal.state === "needs_attention").length,
    },
    crops,
    fruits,
    inventory,
    resources,
    productions,
    animals,
    boosts: summarizeDetectedBoosts(boostContext),
    collectibles,
    rawSections: Object.keys(farm).sort(),
  };
}

export async function POST(request: NextRequest) {
  let body: UnknownRecord;

  try {
    body = asRecord(await request.json());
  } catch {
    return NextResponse.json<FarmLiveLookupResponse>(
      { ok: false, error: "Requisição inválida." },
      { status: 400 },
    );
  }

  const farmId = String(body.farmId ?? "").trim();
  const apiKey = String(body.apiKey ?? "").trim();

  if (!/^\d+$/.test(farmId)) {
    return NextResponse.json<FarmLiveLookupResponse>(
      { ok: false, error: "Farm ID inválida. Use apenas números." },
      { status: 400 },
    );
  }

  if (!apiKey) {
    return NextResponse.json<FarmLiveLookupResponse>(
      { ok: false, error: "Farm API Key não informada." },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${SFL_COMMUNITY_FARM_API}/${encodeURIComponent(farmId)}?t=${Date.now()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
        "Cache-Control": "no-cache, no-store",
        Pragma: "no-cache",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      const message =
        upstream.status === 401 || upstream.status === 403
          ? "Farm API Key inválida, expirada ou sem permissão para esta fazenda."
          : upstream.status === 404
            ? "Fazenda não encontrada para essa Farm ID."
            : `A API do Sunflower Land respondeu com erro ${upstream.status}.`;

      return NextResponse.json<FarmLiveLookupResponse>(
        { ok: false, error: message },
        { status: upstream.status >= 500 ? 502 : upstream.status },
      );
    }

    const payload = (await upstream.json()) as unknown;
    const snapshot = buildSnapshot(farmId, payload);

    return NextResponse.json<FarmLiveLookupResponse>(
      { ok: true, snapshot },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch {
    return NextResponse.json<FarmLiveLookupResponse>(
      {
        ok: false,
        error: "Não foi possível conectar à Community Farm API do Sunflower Land.",
      },
      { status: 502 },
    );
  }
}
