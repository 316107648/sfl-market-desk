import { crafts } from "../gameData";

export function getCraftsUsingItem(itemId: string) {
  return crafts.filter((craft) =>
    craft.ingredients.some(
      (ingredient) => ingredient.itemId === itemId,
    ),
  );
}

export function getCraft(craftId: string) {
  return crafts.find((craft) => craft.id === craftId);
}