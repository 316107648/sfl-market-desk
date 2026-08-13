import { items } from "../gameData/items";
import {
  getRelationship,
  getRelatedItems,
  getProducedBy,
} from "../gameData/relationships";

import { getCraftsUsingItem } from "./recipeKnowledge";
import { getWikiEntry } from "./wiki";
import type { GameItem } from "../gameData/types";

export function getItem(id: string) {
  return items.find((item) => item.id === id);
}

export function getItemKnowledge(id: string) {
  const item = getItem(id);

  if (!item) {
    return undefined;
  }

  return {
    item,
    wiki: getWikiEntry(id),

    relationship: getRelationship(id),

   relatedItems: getRelatedItems(id)
  .map(getItem)
  .filter((item): item is GameItem => item !== undefined),

producedBy: getProducedBy(id)
  .map(getItem)
  .filter((item): item is GameItem => item !== undefined),

    usedIn: getCraftsUsingItem(id),
  };
}