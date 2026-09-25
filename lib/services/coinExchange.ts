import type { PriceMap } from "../market";
import { coinItems } from "../gameData";

export type CoinExchangeCandidate = {
  name: string;
  npcCoins: number;
  marketPrice: number;
  effectiveBuyFlower: number;
  effectiveNpcCoins: number;
  flowerPerCoin: number;
  coinsPerFlower: number;
};

function getPrice(prices: PriceMap, name: string): number | undefined {
  const exact = prices[name];
  if (typeof exact === "number" && Number.isFinite(exact)) return exact;
  const key = Object.keys(prices).find((item) => item.trim().toLowerCase() === name.trim().toLowerCase());
  const value = key ? prices[key] : undefined;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function calculateCoinExchange(
  prices: PriceMap,
  buyFeePct = 0,
  npcCoinMultiplier = 1,
) {
  const buyFee = Math.max(0, buyFeePct) / 100;
  const multiplier = Math.max(0, npcCoinMultiplier || 1);

  const candidates: CoinExchangeCandidate[] = coinItems
    .map((item) => {
      const marketPrice = getPrice(prices, item.name);
      if (marketPrice === undefined || marketPrice <= 0 || item.coins <= 0) return null;
      const effectiveBuyFlower = marketPrice * (1 + buyFee);
      const effectiveNpcCoins = item.coins * multiplier;
      if (effectiveNpcCoins <= 0) return null;
      const flowerPerCoin = effectiveBuyFlower / effectiveNpcCoins;
      return {
        name: item.name,
        npcCoins: item.coins,
        marketPrice,
        effectiveBuyFlower,
        effectiveNpcCoins,
        flowerPerCoin,
        coinsPerFlower: 1 / flowerPerCoin,
      } satisfies CoinExchangeCandidate;
    })
    .filter((item): item is CoinExchangeCandidate => Boolean(item))
    .sort((a, b) => a.flowerPerCoin - b.flowerPerCoin);

  return {
    best: candidates[0] ?? null,
    candidates,
  };
}
