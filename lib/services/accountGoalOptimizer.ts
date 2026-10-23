import { crops, fruits, type CropData } from "../gameData";
import type { FarmProfile } from "../farm";
import type { StoredFarmSnapshot } from "../farm/snapshotStorage";
import type { PriceMap } from "../market";

export type AccountFocus = "flowers" | "xp" | "land";

export type FlowerCandidate = {
  category: "crop" | "fruit" | "resource" | "animal";
  name: string;
  icon: string;
  unitPrice: number;
  estimatedFlowerPerDay?: number;
  note: string;
};

export type XpCandidate = {
  crop: CropData;
  xpPerCycle: number;
  xpPerHour: number;
  theoreticalCycles: number;
};

const RESOURCE_LABELS: Record<string, { market: string; icon: string }> = {
  trees: { market: "Wood", icon: "🌳" },
  stones: { market: "Stone", icon: "🪨" },
  iron: { market: "Iron", icon: "⛏️" },
  gold: { market: "Gold", icon: "🟡" },
  crimstones: { market: "Crimstone", icon: "💎" },
  sunstones: { market: "Sunstone", icon: "☀️" },
  oilReserves: { market: "Oil", icon: "🛢️" },
};

function marketPrice(prices: PriceMap, name: string) {
  if (typeof prices[name] === "number") return prices[name];
  const key = Object.keys(prices).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? prices[key] : undefined;
}

function animalProduction(snapshot: StoredFarmSnapshot, prices: PriceMap): FlowerCandidate[] {
  const totals = new Map<string, number>();

  for (const animal of snapshot.animals) {
    for (const field of animal.apiDiagnosticFields ?? []) {
      const match = field.path.match(/(egg|feather|milk|leather|wool)/i);
      if (!match || !/yield|amount|reward|produce|harvest/i.test(field.path)) continue;
      const amount = Number(String(field.value).replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const name = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
      totals.set(name, (totals.get(name) ?? 0) + amount);
    }
  }

  return [...totals.entries()].flatMap(([name, amount]) => {
    const price = marketPrice(prices, name);
    if (price === undefined) return [];
    return [{
      category: "animal" as const,
      name,
      icon: name === "Milk" ? "🥛" : name === "Wool" ? "🧶" : "🥚",
      unitPrice: price,
      note: `Produção detectada na API: ${amount.toLocaleString("pt-BR")} unidade(s) por ciclo informado.`,
    }];
  });
}

export function buildFlowerPlan(profile: FarmProfile, snapshot: StoredFarmSnapshot | null, prices: PriceMap) {
  const candidates: FlowerCandidate[] = [];

  for (const crop of crops.filter((item) => item.bumpkinLevel <= profile.bumpkinLevel)) {
    const price = marketPrice(prices, crop.name);
    if (price === undefined) continue;
    const hours = Math.max(crop.growTimeSeconds / 3600, 1 / 60);
    const cycles = Math.max(0, Math.floor(profile.activeHoursPerDay / hours));
    candidates.push({
      category: "crop",
      name: crop.name,
      icon: crop.icon ?? "🌱",
      unitPrice: price,
      estimatedFlowerPerDay: price * cycles * profile.cropPlots * (crop.harvestAmount ?? 1),
      note: `${cycles} ciclo(s) por plot em ${profile.activeHoursPerDay}h ativas.`,
    });
  }

  if (snapshot) {
    const fruitCounts = new Map<string, number>();
    for (const fruit of snapshot.fruits) {
      if (!fruit.name || fruit.name === "Fruit Patch") continue;
      fruitCounts.set(fruit.name, (fruitCounts.get(fruit.name) ?? 0) + 1);
    }
    for (const [name, count] of fruitCounts) {
      const definition = fruits.find((item) => item.name.toLowerCase() === name.toLowerCase());
      const price = marketPrice(prices, name);
      if (price === undefined) continue;
      candidates.push({
        category: "fruit",
        name,
        icon: definition?.icon ?? "🍎",
        unitPrice: price,
        note: `${count} patch(es) detectado(s). O ranking usa o preço atual; ciclos/dia entram quando a API fornecer rendimento verificável.`,
      });
    }

    for (const group of snapshot.resources) {
      const definition = RESOURCE_LABELS[group.key];
      if (!definition) continue;
      const price = marketPrice(prices, definition.market);
      if (price === undefined) continue;
      candidates.push({
        category: "resource",
        name: definition.market,
        icon: definition.icon,
        unitPrice: price,
        note: `${group.activeNodes}/${group.totalNodes} nó(s) prontos agora. Sem inventar rendimento por nó.`,
      });
    }

    candidates.push(...animalProduction(snapshot, prices));
  }

  const daily = candidates
    .filter((item) => item.estimatedFlowerPerDay !== undefined)
    .sort((a, b) => (b.estimatedFlowerPerDay ?? 0) - (a.estimatedFlowerPerDay ?? 0));
  const byUnitPrice = [...candidates].sort((a, b) => b.unitPrice - a.unitPrice);

  return {
    bestDaily: daily[0],
    daily,
    byUnitPrice,
    estimatedDailyTotal: daily[0]?.estimatedFlowerPerDay ?? 0,
  };
}

export function buildXpPlan(profile: FarmProfile) {
  const candidates: XpCandidate[] = crops
    .filter((crop) => crop.bumpkinLevel <= profile.bumpkinLevel && typeof crop.xp === "number" && crop.xp > 0)
    .map((crop) => {
      const hours = Math.max(crop.growTimeSeconds / 3600, 1 / 60);
      const theoreticalCycles = Math.max(1, Math.floor(profile.activeHoursPerDay / hours));
      return {
        crop,
        xpPerCycle: crop.xp!,
        xpPerHour: crop.xp! / hours,
        theoreticalCycles,
      };
    })
    // XP focus is intentionally ranked by XP per harvest, not by XP/hour.
    // This prevents very short crops from winning only because they require
    // dozens or hundreds of manual replants during the player's active window.
    .sort((a, b) => {
      if (b.xpPerCycle !== a.xpPerCycle) return b.xpPerCycle - a.xpPerCycle;
      return a.crop.growTimeSeconds - b.crop.growTimeSeconds;
    });

  return { candidates, best: candidates[0] };
}

export type LandRequirement = { name: string; required: number; owned: number; missing: number; progressPct: number };

export function buildLandPlan(snapshot: StoredFarmSnapshot | null, requirements: Record<string, number>) {
  const inventory = new Map((snapshot?.inventory ?? []).map((item) => [item.name.toLowerCase(), item.amount]));
  const rows: LandRequirement[] = Object.entries(requirements)
    .filter(([, required]) => Number.isFinite(required) && required > 0)
    .map(([name, required]) => {
      const owned = inventory.get(name.toLowerCase()) ?? 0;
      const missing = Math.max(0, required - owned);
      return {
        name,
        required,
        owned,
        missing,
        progressPct: Math.min(100, required > 0 ? owned / required * 100 : 100),
      };
    })
    .sort((a, b) => b.missing - a.missing);

  return { rows, next: rows.find((row) => row.missing > 0) };
}

export function parseLandRequirements(raw: string) {
  const result: Record<string, number> = {};
  for (const token of raw.split(/[\n,;]+/)) {
    const match = token.trim().match(/^(.+?)\s*[:=]\s*(\d+(?:[.,]\d+)?)$/);
    if (!match) continue;
    const value = Number(match[2].replace(",", "."));
    if (Number.isFinite(value) && value > 0) result[match[1].trim()] = value;
  }
  return result;
}
