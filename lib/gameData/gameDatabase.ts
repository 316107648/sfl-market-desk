import { items } from "./items";
import type { GameCategory, GameItem } from "./types";

export const gameDatabase = {
  items,
};

export function findItem(id: string): GameItem | undefined {
  return items.find((item) => item.id === id);
}

export function findItemByName(name: string): GameItem | undefined {
  const normalizedName = name.trim().toLowerCase();

  return items.find(
    (item) => item.name.trim().toLowerCase() === normalizedName,
  );
}

export function getItemsByCategory(
  category: GameCategory,
): GameItem[] {
  return items.filter((item) => item.category === category);
}

export function getTradableItems(): GameItem[] {
  return items.filter((item) => item.tradable === true);
}

export function getCoinItems(): GameItem[] {
  return items.filter(
    (item) =>
      item.coinValue !== undefined &&
      item.coinValue > 0,
  );
}