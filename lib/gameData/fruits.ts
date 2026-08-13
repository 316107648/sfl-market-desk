import type { GameItem } from "./types";
export interface FruitData extends GameItem {
  category: "fruit";
}

export const fruits: FruitData[] = [
  {
    id: "tomato",
    name: "Tomato",
    coinValue: 2,
    category: "fruit",
    verified: true,
    source: "official",
  },
  {
    id: "lemon",
    name: "Lemon",
    coinValue: 6,
    category: "fruit",
    verified: true,
    source: "official",
  },
  {
    id: "blueberry",
    name: "Blueberry",
    coinValue: 12,
    category: "fruit",
    verified: true,
    source: "official",
  },
  {
    id: "orange",
    name: "Orange",
    coinValue: 18,
    category: "fruit",
    verified: true,
    source: "official",
  },
  {
    id: "apple",
    name: "Apple",
    coinValue: 25,
    category: "fruit",
    verified: true,
    source: "official",
  },
  {
    id: "banana",
    name: "Banana",
    coinValue: 25,
    category: "fruit",
    verified: true,
    source: "official",
  },
  {
    id: "celestine",
    name: "Celestine",
    coinValue: 200,
    category: "fruit",
    verified: true,
    source: "official",
  },
  {
    id: "lunara",
    name: "Lunara",
    coinValue: 500,
    category: "fruit",
    verified: true,
    source: "official",
  },
  {
    id: "duskberry",
    name: "Duskberry",
    coinValue: 1000,
    category: "fruit",
    verified: true,
    source: "official",
  },
  {
    id: "grape",
    name: "Grape",
    coinValue: 240,
    category: "fruit",
    verified: true,
    source: "official",
  },
];