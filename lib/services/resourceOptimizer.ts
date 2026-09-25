import type { PriceMap } from "../market";
import type { StoredFarmSnapshot } from "../farm/snapshotStorage";

export type ResourcePlanId =
  | "axe-to-wood"
  | "pickaxe-to-stone"
  | "stone-pickaxe-to-iron"
  | "iron-pickaxe-to-gold"
  | "gold-pickaxe-to-crimstone";

export type ResourcePlan = {
  id: ResourcePlanId;
  input: string;
  target: string;
  tool: string;
  icon: string;
  ingredients: Array<{ name: string; amount: number }>;
  coinCost: number;
  sourceNote: string;
};

// Verified against the current in-game tool costs supplied by the user and a
// July 2026 Sunflower Land GitHub discussion (#7400). Keep the structure data-
// driven because balance values can change in future seasons/releases.
export const resourcePlans: ResourcePlan[] = [
  {
    id: "axe-to-wood",
    input: "Wood",
    target: "Wood",
    tool: "Axe",
    icon: "🪓",
    ingredients: [],
    coinCost: 16,
    sourceNote: "16 Coins",
  },
  {
    id: "pickaxe-to-stone",
    input: "Wood",
    target: "Stone",
    tool: "Pickaxe",
    icon: "⛏️",
    ingredients: [{ name: "Wood", amount: 3 }],
    coinCost: 16,
    sourceNote: "3 Wood + 16 Coins",
  },
  {
    id: "stone-pickaxe-to-iron",
    input: "Stone",
    target: "Iron",
    tool: "Stone Pickaxe",
    icon: "⛏️",
    ingredients: [{ name: "Wood", amount: 3 }, { name: "Stone", amount: 5 }],
    coinCost: 16,
    sourceNote: "3 Wood + 5 Stone + 16 Coins",
  },
  {
    id: "iron-pickaxe-to-gold",
    input: "Iron",
    target: "Gold",
    tool: "Iron Pickaxe",
    icon: "⛏️",
    ingredients: [{ name: "Wood", amount: 3 }, { name: "Iron", amount: 5 }],
    coinCost: 64,
    sourceNote: "3 Wood + 5 Iron + 64 Coins",
  },
  {
    id: "gold-pickaxe-to-crimstone",
    input: "Gold",
    target: "Crimstone",
    tool: "Gold Pickaxe",
    icon: "⛏️",
    ingredients: [{ name: "Wood", amount: 3 }, { name: "Gold", amount: 3 }],
    coinCost: 80,
    sourceNote: "3 Wood + 3 Gold + 80 Coins",
  },
];

export type OptimizerInputs = {
  plan: ResourcePlan;
  prices: PriceMap;
  saleFeePct: number;
  buyFeePct: number;
  coinFlowerRate: number;
  effectiveYield: number;
  toolCount: number;
  snapshot: StoredFarmSnapshot | null;
};

function getPrice(prices: PriceMap, name: string) {
  const exact = prices[name];
  if (typeof exact === "number") return exact;
  const key = Object.keys(prices).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? prices[key] : undefined;
}

export function inventoryAmount(snapshot: StoredFarmSnapshot | null, name: string) {
  if (!snapshot) return 0;
  return snapshot.inventory.find((item) => item.name.toLowerCase() === name.toLowerCase())?.amount ?? 0;
}

export function calculateResourcePlan(input: OptimizerInputs) {
  const { plan, prices, saleFeePct, buyFeePct, coinFlowerRate, effectiveYield, toolCount, snapshot } = input;
  const saleFee = Math.max(0, saleFeePct) / 100;
  const buyFee = Math.max(0, buyFeePct) / 100;
  const count = Math.max(1, toolCount);

  const targetPrice = getPrice(prices, plan.target);
  const inputPrice = getPrice(prices, plan.input);

  const ingredientRows = plan.ingredients.map((ingredient) => {
    const price = getPrice(prices, ingredient.name);
    const needed = ingredient.amount * count;
    const owned = inventoryAmount(snapshot, ingredient.name);
    const fromInventory = Math.min(owned, needed);
    const toBuy = Math.max(0, needed - owned);
    const opportunityCost = (price ?? 0) * needed * (1 - saleFee);
    const cashPurchaseCost = (price ?? 0) * toBuy * (1 + buyFee);
    return { ...ingredient, price, needed, owned, fromInventory, toBuy, opportunityCost, cashPurchaseCost };
  });

  const materialOpportunityCost = ingredientRows.reduce((sum, row) => sum + row.opportunityCost, 0);
  const materialCashCost = ingredientRows.reduce((sum, row) => sum + row.cashPurchaseCost, 0);
  const coinCostFlower = Math.max(0, plan.coinCost * count * coinFlowerRate);
  const craftEconomicCost = materialOpportunityCost + coinCostFlower;
  const craftCashOutlay = materialCashCost + coinCostFlower;

  const minedAmount = Math.max(0, effectiveYield) * count;
  const minedGrossFlower = (targetPrice ?? 0) * minedAmount;
  const minedNetSaleFlower = minedGrossFlower * (1 - saleFee);
  const miningProfitFlower = minedNetSaleFlower - craftEconomicCost;

  const mainIngredient = ingredientRows.find((row) => row.name.toLowerCase() === plan.input.toLowerCase()) ?? ingredientRows[0];
  const sellInputGross = (inputPrice ?? 0) * (mainIngredient?.needed ?? 0);
  const sellInputNet = sellInputGross * (1 - saleFee);
  const effectiveTargetBuyPrice = (targetPrice ?? 0) * (1 + buyFee);
  const targetBought = effectiveTargetBuyPrice > 0 ? sellInputNet / effectiveTargetBuyPrice : 0;

  const alternativeBudgetFlower = craftEconomicCost;
  const targetBoughtEconomic = effectiveTargetBuyPrice > 0 ? alternativeBudgetFlower / effectiveTargetBuyPrice : 0;
  const breakEvenYieldPerTool = count > 0 ? targetBoughtEconomic / count : 0;

  const miningAdvantageTarget = minedAmount - targetBoughtEconomic;
  const miningAdvantageFlower = minedNetSaleFlower - craftEconomicCost;

  const missingPrices = new Set<string>();
  if (targetPrice === undefined) missingPrices.add(plan.target);
  if (inputPrice === undefined) missingPrices.add(plan.input);
  ingredientRows.forEach((row) => { if (row.price === undefined) missingPrices.add(row.name); });

  const relevantBoosts = snapshot
    ? [
        ...snapshot.boosts.map((boost) => ({ name: boost.name, source: boost.source, note: boost.note, applied: boost.applied })),
        ...snapshot.collectibles.map((item) => ({ name: item.name, source: "collectible" as const, note: item.boostKnown ? "Collectible com efeito conhecido pelo Boost Engine." : "Efeito ainda não mapeado.", applied: item.boostKnown })),
      ]
    : [];

  return {
    ingredientRows,
    materialOpportunityCost,
    materialCashCost,
    coinCostFlower,
    craftEconomicCost,
    craftCashOutlay,
    minedAmount,
    minedGrossFlower,
    minedNetSaleFlower,
    miningProfitFlower,
    sellInputGross,
    sellInputNet,
    targetBought,
    alternativeBudgetFlower,
    targetBoughtEconomic,
    breakEvenYieldPerTool,
    miningAdvantageTarget,
    miningAdvantageFlower,
    complete: missingPrices.size === 0,
    missingPrices: [...missingPrices],
    relevantBoosts,
  };
}
