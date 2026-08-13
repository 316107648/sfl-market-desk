import type { GameItem } from "./types";

export interface CraftIngredient {
  itemId: string;
  amount: number;
}

export interface CraftData extends GameItem {
  category: "food";
  ingredients: CraftIngredient[];
  craftingTimeSeconds?: number;
  building?: string;
  xp?: number;
}

export const crafts: CraftData[] = [
  {
  id: "bread",
  name: "Bread",
  category: "food",
  icon: "🍞",

  description: "Um alimento produzido a partir de ingredientes agrícolas.",

  ingredients: [
    {
      itemId: "wheat",
      amount: 3,
    },
  ],

  craftingTimeSeconds: 300,
  building: "Kitchen",
  xp: 5,

  requiredLevel: 1,
  rarity: "common",
  tradable: true,

  obtainedFrom: ["Kitchen"],
  tags: ["food", "craft", "wheat"],

  verified: false,
  source: "manual",
},
];