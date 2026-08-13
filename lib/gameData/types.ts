export type GameCategory =
  | "crop"
  | "fruit"
  | "flower"
  | "resource"
  | "fish"
  | "animal"
  | "food";

export interface GameItem {
  id: string;
  name: string;
  category: GameCategory;

  icon?: string;
  description?: string;

  coinValue?: number;
  requiredLevel?: number;

  rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";

  tradable?: boolean;

  obtainedFrom?: string[];
  purchasedFrom?: string[];
  tags?: string[];

  verified: boolean;
  source: "official" | "manual";
}