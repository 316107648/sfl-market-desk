import { getItemKnowledge } from "../knowledge";

export function getItemDetails(id: string) {
  return getItemKnowledge(id);
}

export function hasCrafts(id: string) {
  const knowledge = getItemKnowledge(id);

  return (knowledge?.usedIn.length ?? 0) > 0;
}

export function hasRelatedItems(id: string) {
  const knowledge = getItemKnowledge(id);

  return (knowledge?.relatedItems.length ?? 0) > 0;
}