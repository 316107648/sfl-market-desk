export type BoostSourceKind = "collectible" | "wearable" | "skill" | "system";

export type DetectedBoost = {
  name: string;
  source: BoostSourceKind;
  applied: boolean;
  note?: string;
};

export type AppliedTimeBoost = {
  name: string;
  factor: number;
  source: BoostSourceKind;
  note?: string;
};

export type BoostContext = {
  collectibleNames: Set<string>;
  wearableNames: Set<string>;
  skillNames: Set<string>;
  placements: Array<{ name: string; x?: number; y?: number; placedAt?: number }>;
};

export type TimeBoostTarget = {
  category: "crop" | "fruit" | "tree" | "mineral" | "cooking";
  name: string;
  x?: number;
  y?: number;
  startedAt?: number;
};

function norm(value: string) {
  return value.trim().toLowerCase();
}

export function hasNamed(set: Set<string>, name: string) {
  return set.has(norm(name));
}

function placementFor(context: BoostContext, name: string) {
  const n = norm(name);
  return context.placements.filter((item) => norm(item.name) === n);
}

function wasPlacedBefore(context: BoostContext, name: string, startedAt?: number) {
  const matches = placementFor(context, name);
  if (!matches.length) return false;
  if (startedAt === undefined) return true;
  return matches.some((item) => item.placedAt === undefined || item.placedAt <= startedAt);
}

function isWithinBasicScarecrow(context: BoostContext, x?: number, y?: number) {
  if (x === undefined || y === undefined) return false;
  const scarecrows = placementFor(context, "Basic Scarecrow");
  return scarecrows.some((item) =>
    item.x !== undefined && item.y !== undefined &&
    Math.abs(item.x - x) <= 1 && Math.abs(item.y - y) <= 1
  );
}

export function calculateEffectiveDuration(
  baseDurationMs: number,
  target: TimeBoostTarget,
  context: BoostContext,
): { effectiveDurationMs: number; boosts: AppliedTimeBoost[] } {
  const boosts: AppliedTimeBoost[] = [];
  const item = norm(target.name);

  const apply = (name: string, factor: number, source: BoostSourceKind, note?: string) => {
    boosts.push({ name, factor, source, note });
  };

  if (target.category === "crop") {
    // Nancy, Scarecrow and Kuebiko do not stack with each other. Kuebiko has priority,
    // then Scarecrow, then Nancy, matching the documented anti-stack relationship.
    if (hasNamed(context.collectibleNames, "Kuebiko")) {
      apply("Kuebiko", 0.85, "collectible", "15% faster crop growth");
    } else if (hasNamed(context.collectibleNames, "Scarecrow")) {
      apply("Scarecrow", 0.85, "collectible", "15% faster crop growth");
    } else if (hasNamed(context.collectibleNames, "Nancy")) {
      apply("Nancy", 0.85, "collectible", "15% faster crop growth");
    }

    if (hasNamed(context.collectibleNames, "Lunar Calendar")) {
      apply("Lunar Calendar", 0.90, "collectible", "10% faster crop growth");
    }

    if (item === "parsnip" && hasNamed(context.collectibleNames, "Mysterious Parsnip")) {
      apply("Mysterious Parsnip", 0.50, "collectible", "50% faster Parsnip growth");
    }
    if (item === "cabbage" && hasNamed(context.collectibleNames, "Cabbage Girl")) {
      apply("Cabbage Girl", 0.50, "collectible", "50% faster Cabbage growth");
    }
    if (item === "eggplant" && hasNamed(context.collectibleNames, "Obie")) {
      apply("Obie", 0.75, "collectible", "25% faster Eggplant growth");
    }
    if (item === "corn" && hasNamed(context.collectibleNames, "Kernaldo")) {
      apply("Kernaldo", 0.75, "collectible", "25% faster Corn growth");
    }
    if (item === "carrot" && hasNamed(context.wearableNames, "Carrot Amulet")) {
      apply("Carrot Amulet", 0.80, "wearable", "20% faster Carrot growth");
    }

    if (["sunflower", "potato", "pumpkin"].includes(item) && isWithinBasicScarecrow(context, target.x, target.y)) {
      apply("Basic Scarecrow", 0.80, "collectible", "AOE: 20% faster for this crop");
    }
  }

  if (target.category === "fruit") {
    if (item === "orange" && hasNamed(context.collectibleNames, "Squirrel Monkey")) {
      apply("Squirrel Monkey", 0.50, "collectible", "50% faster Orange fruit growth");
    }
    if (item === "banana" && hasNamed(context.collectibleNames, "Nana")) {
      apply("Nana", 0.90, "collectible", "10% faster Banana growth");
    }
  }

  if (target.category === "tree") {
    if (hasNamed(context.collectibleNames, "Foreman Beaver")) {
      apply("Foreman Beaver", 0.50, "collectible", "50% faster tree growth");
    } else if (hasNamed(context.collectibleNames, "Apprentice Beaver")) {
      apply("Apprentice Beaver", 0.50, "collectible", "50% faster tree growth");
    }
  }

  if (target.category === "cooking" && hasNamed(context.wearableNames, "Luna's Hat")) {
    apply("Luna's Hat", 0.50, "wearable", "50% faster cooking");
  }

  // Time Warp Totem affects crop, mineral, cooking and tree time. The official rule
  // requires it to be placed before the action started, so we only apply it when that
  // ordering can be satisfied by the current save.
  if (["crop", "tree", "mineral", "cooking"].includes(target.category) &&
      wasPlacedBefore(context, "Time Warp Totem", target.startedAt)) {
    apply("Time Warp Totem", 0.50, "collectible", "50% time reduction; placed before action");
  }

  const factor = boosts.reduce((current, boost) => current * boost.factor, 1);
  return {
    effectiveDurationMs: Math.max(1_000, Math.round(baseDurationMs * factor)),
    boosts,
  };
}


export function collectibleBonusSummary(name: string): string {
  const key = norm(name);
  const summaries: Record<string, string> = {
    "basic scarecrow": "AOE: 20% mais rápido para Sunflower, Potato e Pumpkin na área de efeito.",
    "nancy": "15% mais rápido no crescimento de crops; não acumula com Scarecrow/Kuebiko.",
    "scarecrow": "15% mais rápido no crescimento de crops; não acumula com Nancy/Kuebiko.",
    "kuebiko": "15% mais rápido no crescimento de crops; prioridade sobre Scarecrow/Nancy.",
    "mysterious parsnip": "50% mais rápido no crescimento de Parsnip.",
    "cabbage girl": "50% mais rápido no crescimento de Cabbage.",
    "lunar calendar": "10% mais rápido no crescimento de crops.",
    "obie": "25% mais rápido no crescimento de Eggplant.",
    "kernaldo": "25% mais rápido no crescimento de Corn.",
    "squirrel monkey": "50% mais rápido no crescimento de Orange.",
    "nana": "10% mais rápido no crescimento de Banana.",
    "apprentice beaver": "50% mais rápido na regeneração de árvores.",
    "foreman beaver": "50% mais rápido na regeneração de árvores.",
    "time warp totem": "50% de redução de tempo em crop, árvore, mineral e cooking quando colocado antes da ação.",
  };
  return summaries[key] ?? "Efeito ainda não mapeado no Boost Engine.";
}

export function summarizeDetectedBoosts(context: BoostContext): DetectedBoost[] {
  const rows: DetectedBoost[] = [];
  const knownCollectibles = [
    "Basic Scarecrow", "Nancy", "Scarecrow", "Kuebiko", "Mysterious Parsnip",
    "Cabbage Girl", "Lunar Calendar", "Obie", "Kernaldo", "Squirrel Monkey",
    "Nana", "Apprentice Beaver", "Foreman Beaver", "Time Warp Totem",
  ];
  const knownWearables = ["Carrot Amulet", "Luna's Hat"];

  for (const name of knownCollectibles) {
    if (hasNamed(context.collectibleNames, name)) {
      rows.push({ name, source: "collectible", applied: true });
    }
  }
  for (const name of knownWearables) {
    if (hasNamed(context.wearableNames, name)) {
      rows.push({ name, source: "wearable", applied: true });
    }
  }
  for (const skill of [...context.skillNames].sort()) {
    rows.push({
      name: skill,
      source: "skill",
      applied: false,
      note: "Skill detectada; efeito de duração ainda não aplicado sem regra percentual confirmada.",
    });
  }
  return rows;
}
