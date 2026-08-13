import type {
  LeagueAccount,
  LeagueHolding,
  LeagueTrade,
} from "./types";

export const INITIAL_DEMO_FLOWER = 100;

export function createLeagueAccount(): LeagueAccount {
  return {
    demoFlowerBalance: INITIAL_DEMO_FLOWER,
    holdings: [],
    trades: [],
    xp: 0,
    level: 1,
    rankingPoints: 0,
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
  return (
    account.demoFlowerBalance +
    calculatePortfolioValue(account, prices)
  );
}

export function buyAsset(
  account: LeagueAccount,
  itemName: string,
  quantity: number,
  unitPrice: number,
): LeagueAccount {
  if (quantity <= 0 || unitPrice <= 0) {
    throw new Error("Quantidade e preço devem ser maiores que zero.");
  }

  const total = quantity * unitPrice;

  if (total > account.demoFlowerBalance) {
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
          (holding.quantity * holding.averagePrice + total) /
          nextQuantity;

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

  const trade = createTrade(
    "buy",
    itemName,
    quantity,
    unitPrice,
  );

  return {
    ...account,
    demoFlowerBalance: account.demoFlowerBalance - total,
    holdings: nextHoldings,
    trades: [trade, ...account.trades],
    xp: account.xp + 10,
    rankingPoints: account.rankingPoints + 2,
  };
}

export function sellAsset(
  account: LeagueAccount,
  itemName: string,
  quantity: number,
  unitPrice: number,
): LeagueAccount {
  if (quantity <= 0 || unitPrice <= 0) {
    throw new Error("Quantidade e preço devem ser maiores que zero.");
  }

  const holding = getHolding(account, itemName);

  if (!holding || holding.quantity < quantity) {
    throw new Error("Quantidade insuficiente na carteira.");
  }

  const total = quantity * unitPrice;

  const nextHoldings = account.holdings
    .map((currentHolding) =>
      currentHolding.itemName === itemName
        ? {
            ...currentHolding,
            quantity: currentHolding.quantity - quantity,
          }
        : currentHolding,
    )
    .filter((currentHolding) => currentHolding.quantity > 0);

  const trade = createTrade(
    "sell",
    itemName,
    quantity,
    unitPrice,
  );

  const profit =
    (unitPrice - holding.averagePrice) * quantity;

  return {
    ...account,
    demoFlowerBalance: account.demoFlowerBalance + total,
    holdings: nextHoldings,
    trades: [trade, ...account.trades],
    xp: account.xp + 10,
    rankingPoints:
      account.rankingPoints + Math.max(1, Math.floor(profit)),
  };
}

function createTrade(
  type: "buy" | "sell",
  itemName: string,
  quantity: number,
  unitPrice: number,
): LeagueTrade {
  return {
    id: `${Date.now()}-${Math.random()}`,
    type,
    itemName,
    quantity,
    unitPrice,
    total: quantity * unitPrice,
    createdAt: Date.now(),
  };
}