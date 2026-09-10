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
  realizedProfit?: number;
};

export type LeagueAccount = {
  demoFlowerBalance: number;
  holdings: LeagueHolding[];
  trades: LeagueTrade[];
  xp: number;
  level: number;
  rankingPoints: number;
  createdAt: number;
};

export type LeagueTier = {
  name: "Bronze" | "Prata" | "Ouro" | "Platina" | "Diamante" | "Mestre";
  icon: string;
  minPoints: number;
  nextPoints?: number;
};
