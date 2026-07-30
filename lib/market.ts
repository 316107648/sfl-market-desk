export type PriceMap = Record<string, number>;

export type MarketResponse = {
  ok: boolean;
  source?: string;
  updatedAt?: string;
  count?: number;
  prices?: PriceMap;
  error?: string;
};

export const demoPrices: PriceMap = {
  Gold: 0.084,
  Wood: 0.0062,
  Stone: 0.0104,
  Iron: 0.054,
  Crimstone: 0.91,
  Duskberry: 0.9248,
  Apple: 0.022,
  Radish: 0.01037,
  Wheat: 0.0153,
  Sunflower: 0.00034,
};

export function normalizePrices(payload: unknown): PriceMap {
  const data = payload as any;
  const candidates = [data?.data?.p2p, data?.p2p, data?.data, data];
  for (const raw of candidates) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const prices: PriceMap = {};
    for (const [name, value] of Object.entries(raw)) {
      const nested = value as any;
      const price = typeof value === "object"
        ? Number(nested?.price ?? nested?.floor ?? nested?.value)
        : Number(value);
      if (Number.isFinite(price) && price >= 0) prices[name] = price;
    }
    if (Object.keys(prices).length) return prices;
  }
  throw new Error("Formato de precios no reconocido");
}
