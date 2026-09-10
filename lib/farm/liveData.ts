export type FarmLiveCrop = {
  id: string;
  name: string;
  amount: number;
  plantedAt?: number;
  readyAt?: number;
  baseDurationMs?: number;
  effectiveDurationMs?: number;
  boostLabels?: string[];
};

export type FarmLiveNode = {
  id: string;
  group: string;
  label: string;
  readyAt?: number;
  status: "ready" | "recovering" | "unknown";
  baseDurationMs?: number;
  effectiveDurationMs?: number;
  boostLabels?: string[];
  diagnosticFields?: string[];
};

export type FarmLiveResourceGroup = {
  key: string;
  label: string;
  totalNodes: number;
  activeNodes: number;
  nodes: FarmLiveNode[];
};

export type FarmLiveFruit = {
  id: string;
  name: string;
  plantedAt?: number;
  readyAt?: number;
  harvestsLeft?: number;
  status: "ready" | "growing" | "empty" | "unknown";
  baseDurationMs?: number;
  effectiveDurationMs?: number;
  boostLabels?: string[];
  diagnosticFields?: string[];
};

export type FarmLiveProduction = {
  id: string;
  building: string;
  item: string;
  readyAt?: number;
  status: "ready" | "cooking" | "unknown";
  baseDurationMs?: number;
  effectiveDurationMs?: number;
  boostLabels?: string[];
};

export type FarmLiveAnimal = {
  id: string;
  kind: string;
  name?: string;
  state: "awake" | "sleeping" | "sick" | "needs_attention" | "unknown";
  readyAt?: number;
  affectionAt?: number;
  affectionLabel?: string;
  diagnosticFields?: string[];
  buffFields?: string[];
  apiDiagnosticFields?: Array<{ path: string; value: string }>;
  rawData?: unknown;
  level?: number;
  note?: string;
};

export type FarmLiveSnapshot = {
  farmId: string;
  provider: string;
  fetchedAt: number;
  bumpkin: { name?: string; experience?: number };
  summary: {
    cropPlots: number; plantedCrops: number; fruitPatches: number; chickens: number;
    barnAnimals: number; buildings: number; collectibles: number; inventoryItems: number;
    activeTrades: number; readyCrops: number; readyResources: number; activeProductions: number;
    animalsNeedingAttention: number;
  };
  crops: FarmLiveCrop[];
  fruits: FarmLiveFruit[];
  inventory: Array<{ name: string; amount: number }>;
  resources: FarmLiveResourceGroup[];
  productions: FarmLiveProduction[];
  animals: FarmLiveAnimal[];
  boosts: Array<{ name: string; source: "collectible" | "wearable" | "skill" | "system"; applied: boolean; note?: string }> ;
  collectibles: Array<{ name: string; count: number; area: "farm" | "home" | "both"; boostKnown: boolean }>;
  rawSections: string[];
};

export type FarmLiveLookupResponse = { ok: boolean; snapshot?: FarmLiveSnapshot; error?: string };
