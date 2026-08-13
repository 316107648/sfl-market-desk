import { crafts } from "../gameData";
import type { CraftData } from "../gameData";

export function getCraftById(craftId: string): CraftData | undefined {
  return crafts.find((craft) => craft.id === craftId);
}

export function getCraftIngredientCount(craftId: string): number {
  const craft = getCraftById(craftId);

  if (!craft) {
    return 0;
  }

  return craft.ingredients.reduce(
    (total, ingredient) => total + ingredient.amount,
    0,
  );
}

export function getCraftTimeSeconds(craftId: string): number {
  return getCraftById(craftId)?.craftingTimeSeconds ?? 0;
}

export function getCraftXp(craftId: string): number {
  return getCraftById(craftId)?.xp ?? 0;
}

export function getCraftsByBuilding(building: string): CraftData[] {
  return crafts.filter((craft) => craft.building === building);
}