import type { GameItem } from "./types";

export interface FlowerData extends GameItem {
  category: "flower";
  seed:
    | "Sunpetal Seed"
    | "Bloom Seed"
    | "Lily Seed"
    | "Edelweiss Seed"
    | "Gladiolus Seed"
    | "Lavender Seed"
    | "Clover Seed";
}

export const flowers: FlowerData[] = [
  {
    id: "red-pansy",
    name: "Red Pansy",
    category: "flower",
    seed: "Sunpetal Seed",
    verified: true,
    source: "official",
  },
  {
    id: "yellow-pansy",
    name: "Yellow Pansy",
    category: "flower",
    seed: "Sunpetal Seed",
    verified: true,
    source: "official",
  },
  {
    id: "purple-pansy",
    name: "Purple Pansy",
    category: "flower",
    seed: "Sunpetal Seed",
    verified: true,
    source: "official",
  },
  {
    id: "white-pansy",
    name: "White Pansy",
    category: "flower",
    seed: "Sunpetal Seed",
    verified: true,
    source: "official",
  },
  {
    id: "blue-pansy",
    name: "Blue Pansy",
    category: "flower",
    seed: "Sunpetal Seed",
    verified: true,
    source: "official",
  },
];