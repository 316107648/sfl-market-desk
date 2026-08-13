export type LeagueHolding = {
  itemName: string;
  quantity: number;
  averagePrice: number;
};

export type LeagueTrade = {
  id: string;
  type: "buy" | "sell";
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: number;
};

export type LeagueAccount = {
  demoFlowerBalance: number;
  holdings: LeagueHolding[];
  trades: LeagueTrade[];
  xp: number;
  level: number;
  rankingPoints: number;
};