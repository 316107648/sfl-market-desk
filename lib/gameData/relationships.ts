
export interface ItemRelationship {
  itemId: string;

  usedIn?: string[];
  producedBy?: string[];
  relatedItems?: string[];
}

export const relationships: ItemRelationship[] = [
  {
    itemId: "sunflower",
    usedIn: [],
    producedBy: [],
    relatedItems: ["sunflower-seed"],
  },
];

export function getRelationship(
  itemId: string,
): ItemRelationship | undefined {
  return relationships.find(
    (relationship) => relationship.itemId === itemId,
  );
}

export function getUsedIn(itemId: string): string[] {
  return getRelationship(itemId)?.usedIn ?? [];
}

export function getProducedBy(itemId: string): string[] {
  return getRelationship(itemId)?.producedBy ?? [];
}

export function getRelatedItems(itemId: string): string[] {
  return getRelationship(itemId)?.relatedItems ?? [];
}

