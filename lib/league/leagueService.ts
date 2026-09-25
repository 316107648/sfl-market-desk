import type {
  LeagueAccount,
  LeagueHolding,
  LeagueTier,
  LeagueTrade,
} from "./types";

export const INITIAL_DEMO_FLOWER = 100;
export const XP_PER_LEVEL = 100;

const LEAGUE_TIERS: LeagueTier[] = [
  { name: "Bronze", icon: "🥉", minPoints: 0, nextPoints: 100 },
  { name: "Prata", icon: "🥈", minPoints: 100, nextPoints: 250 },
  { name: "Ouro", icon: "🥇", minPoints: 250, nextPoints: 500 },
  { name: "Platina", icon: "🏅", minPoints: 500, nextPoints: 900 },
  { name: "Diamante", icon: "💎", minPoints: 900, nextPoints: 1500 },
  { name: "Mestre", icon: "👑", minPoints: 1500 },
];

export function createLeagueAccount(): LeagueAccount {
  return {
    demoFlowerBalance: INITIAL_DEMO_FLOWER,
    holdings: [],
    trades: [],
    xp: 0,
    level: 1,
    rankingPoints: 0,
    createdAt: Date.now(),
  };
}

export function normalizeLeagueAccount(value: unknown): LeagueAccount {
  const fallback = createLeagueAccount();

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<LeagueAccount>;
  const xp = safeNumber(candidate.xp, 0);

  return {
    demoFlowerBalance: safeNumber(
      candidate.demoFlowerBalance,
      fallback.demoFlowerBalance,
    ),
    holdings: Array.isArray(candidate.holdings)
      ? candidate.holdings.filter(isLeagueHolding)
      : [],
    trades: Array.isArray(candidate.trades)
      ? candidate.trades.filter(isLeagueTrade)
      : [],
    xp,
    level: calculateLevel(xp),
    rankingPoints: Math.max(0, safeNumber(candidate.rankingPoints, 0)),
    createdAt: safeNumber(candidate.createdAt, Date.now()),
  };
}

export function getHolding(
  account: LeagueAccount,
  itemName: string,
): LeagueHolding | undefined {
  return account.holdings.find(
    (holding) => holding.itemName === itemName,
  );
}

export function calculatePortfolioValue(
  account: LeagueAccount,
  prices: Record<string, number>,
): number {
  return account.holdings.reduce((total, holding) => {
    const currentPrice = prices[holding.itemName] ?? 0;
    return total + holding.quantity * currentPrice;
  }, 0);
}

export function calculateNetWorth(
  account: LeagueAccount,
  prices: Record<string, number>,
): number {
  return account.demoFlowerBalance + calculatePortfolioValue(account, prices);
}

export function calculateUnrealizedProfit(
  account: LeagueAccount,
  prices: Record<string, number>,
): number {
  return account.holdings.reduce((total, holding) => {
    const currentPrice = prices[holding.itemName] ?? 0;
    return total + (currentPrice - holding.averagePrice) * holding.quantity;
  }, 0);
}

export function calculateRealizedProfit(account: LeagueAccount): number {
  return account.trades.reduce(
    (total, trade) => total + (trade.realizedProfit ?? 0),
    0,
  );
}

export function calculateTotalReturnPercent(
  account: LeagueAccount,
  prices: Record<string, number>,
): number {
  const netWorth = calculateNetWorth(account, prices);
  return ((netWorth - INITIAL_DEMO_FLOWER) / INITIAL_DEMO_FLOWER) * 100;
}

export function calculateLevel(xp: number): number {
  return Math.max(1, Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1);
}

export function getLevelProgress(xp: number) {
  const safeXp = Math.max(0, xp);
  const level = calculateLevel(safeXp);
  const currentLevelXp = (level - 1) * XP_PER_LEVEL;
  const progressXp = safeXp - currentLevelXp;

  return {
    level,
    progressXp,
    requiredXp: XP_PER_LEVEL,
    percent: Math.min(100, (progressXp / XP_PER_LEVEL) * 100),
  };
}

export function getLeagueTier(rankingPoints: number): LeagueTier {
  const safePoints = Math.max(0, rankingPoints);

  return (
    [...LEAGUE_TIERS]
      .reverse()
      .find((tier) => safePoints >= tier.minPoints) ?? LEAGUE_TIERS[0]
  );
}

export function buyAsset(
  account: LeagueAccount,
  itemName: string,
  quantity: number,
  unitPrice: number,
): LeagueAccount {
  validateOrder(itemName, quantity, unitPrice);

  const total = quantity * unitPrice;

  if (total > account.demoFlowerBalance + Number.EPSILON) {
    throw new Error("Saldo Demo FLOWER insuficiente.");
  }

  const existingHolding = getHolding(account, itemName);

  const nextHoldings = existingHolding
    ? account.holdings.map((holding) => {
        if (holding.itemName !== itemName) {
          return holding;
        }

        const nextQuantity = holding.quantity + quantity;
        const nextAveragePrice =
          (holding.quantity * holding.averagePrice + total) / nextQuantity;

        return {
          ...holding,
          quantity: nextQuantity,
          averagePrice: nextAveragePrice,
        };
      })
    : [
        ...account.holdings,
        {
          itemName,
          quantity,
          averagePrice: unitPrice,
        },
      ];

  const nextXp = account.xp + 10;
  const trade = createTrade("buy", itemName, quantity, unitPrice);

  return {
    ...account,
    demoFlowerBalance: account.demoFlowerBalance - total,
    holdings: nextHoldings,
    trades: [trade, ...account.trades].slice(0, 500),
    xp: nextXp,
    level: calculateLevel(nextXp),
    rankingPoints: account.rankingPoints + 1,
  };
}

export function sellAsset(
  account: LeagueAccount,
  itemName: string,
  quantity: number,
  unitPrice: number,
): LeagueAccount {
  validateOrder(itemName, quantity, unitPrice);

  const holding = getHolding(account, itemName);

  if (!holding || holding.quantity + Number.EPSILON < quantity) {
    throw new Error("Quantidade insuficiente na carteira.");
  }

  const total = quantity * unitPrice;
  const realizedProfit = (unitPrice - holding.averagePrice) * quantity;

  const nextHoldings = account.holdings
    .map((currentHolding) =>
      currentHolding.itemName === itemName
        ? {
            ...currentHolding,
            quantity: currentHolding.quantity - quantity,
          }
        : currentHolding,
    )
    .filter((currentHolding) => currentHolding.quantity > 0.00000001);

  const trade = createTrade(
    "sell",
    itemName,
    quantity,
    unitPrice,
    realizedProfit,
  );

  const nextXp = account.xp + (realizedProfit > 0 ? 15 : 10);
  const performanceBonus = realizedProfit > 0
    ? Math.max(1, Math.round((realizedProfit / INITIAL_DEMO_FLOWER) * 1000))
    : 0;

  return {
    ...account,
    demoFlowerBalance: account.demoFlowerBalance + total,
    holdings: nextHoldings,
    trades: [trade, ...account.trades].slice(0, 500),
    xp: nextXp,
    level: calculateLevel(nextXp),
    rankingPoints: Math.max(
      0,
      account.rankingPoints + 1 + performanceBonus,
    ),
  };
}

function createTrade(
  type: "buy" | "sell",
  itemName: string,
  quantity: number,
  unitPrice: number,
  realizedProfit?: number,
): LeagueTrade {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    type,
    itemName,
    quantity,
    unitPrice,
    total: quantity * unitPrice,
    createdAt: Date.now(),
    realizedProfit,
  };
}

function validateOrder(
  itemName: string,
  quantity: number,
  unitPrice: number,
) {
  if (!itemName) {
    throw new Error("Selecione um ativo.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("A quantidade deve ser maior que zero.");
  }

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error("Preço indisponível para este ativo.");
  }
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isLeagueHolding(value: unknown): value is LeagueHolding {
  if (!value || typeof value !== "object") return false;
  const holding = value as Partial<LeagueHolding>;

  return (
    typeof holding.itemName === "string" &&
    typeof holding.quantity === "number" &&
    Number.isFinite(holding.quantity) &&
    holding.quantity > 0 &&
    typeof holding.averagePrice === "number" &&
    Number.isFinite(holding.averagePrice) &&
    holding.averagePrice >= 0
  );
}

function isLeagueTrade(value: unknown): value is LeagueTrade {
  if (!value || typeof value !== "object") return false;
  const trade = value as Partial<LeagueTrade>;

  return (
    typeof trade.id === "string" &&
    (trade.type === "buy" || trade.type === "sell") &&
    typeof trade.itemName === "string" &&
    typeof trade.quantity === "number" &&
    Number.isFinite(trade.quantity) &&
    typeof trade.unitPrice === "number" &&
    Number.isFinite(trade.unitPrice) &&
    typeof trade.total === "number" &&
    Number.isFinite(trade.total) &&
    typeof trade.createdAt === "number" &&
    Number.isFinite(trade.createdAt)
  );
}
