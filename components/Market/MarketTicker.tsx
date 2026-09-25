import type { PriceMap } from "../../lib/market";

type HistoryPoint = {
  time: number;
  price: number;
};

type History = Record<string, HistoryPoint[]>;

type MarketTickerProps = {
  prices: PriceMap;
  history: History;
  onSelect?: (name: string) => void;
};

export default function MarketTicker({
  prices,
  history,
  onSelect,
}: MarketTickerProps) {
  const entries = Object.entries(prices);

  if (entries.length === 0) {
    return null;
  }

  const duplicatedEntries = [...entries, ...entries];

  return (
    <div className="market-ticker">
      <div className="market-ticker-track">
        {duplicatedEntries.map(([name, price], index) => {
          const change = calculateChange(history[name] ?? []);

          const direction =
            change > 0
              ? "positive"
              : change < 0
                ? "negative"
                : "neutral";

          return (
            <button
              type="button"
              className="market-ticker-item"
              key={`${name}-${index}`}
              onClick={() => onSelect?.(name)}
            >
              <strong>{name}</strong>

              <span>{price.toFixed(6)}</span>

              <span className={direction}>
                {change > 0
                  ? `▲ ${change.toFixed(2)}%`
                  : change < 0
                    ? `▼ ${Math.abs(change).toFixed(2)}%`
                    : "— 0.00%"}
              </span>

              <span className="market-ticker-separator">|</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function calculateChange(points: HistoryPoint[]): number {
  if (points.length < 2) {
    return 0;
  }

  const firstPrice = points[0].price;
  const lastPrice = points[points.length - 1].price;

  if (firstPrice === 0) {
    return 0;
  }

  return ((lastPrice - firstPrice) / firstPrice) * 100;
}