export interface WikiEntry {
  itemId: string;
  description: string;
  tips: string[];
  strategy: string[];
  trivia?: string[];
}

export const wikiEntries: WikiEntry[] = [
  {
    itemId: "bread",
    description:
      "Alimento produzido a partir de ingredientes agrícolas.",
    tips: [
      "Compare o custo dos ingredientes antes de fabricar.",
    ],
    strategy: [
      "Use os preços atuais do mercado para avaliar se compensa fabricar ou comprar.",
    ],
  },
];

export function getWikiEntry(
  itemId: string,
): WikiEntry | undefined {
  return wikiEntries.find(
    (entry) => entry.itemId === itemId,
  );
}