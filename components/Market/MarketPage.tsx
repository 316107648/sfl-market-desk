import PriceChart from "../PriceChart";
import type { PriceMap } from "../../lib/market";

type HistoryPoint = {
  time: number;
  price: number;
};

type ChartPoint = {
  label: string;
  value: number;
};

type History = Record<string, HistoryPoint[]>;

type MarketSignal = {
  label: "COMPRAR" | "MANTER" | "VENDER";
  kind: "buy" | "hold" | "sell";
  confidence: number;
  change: number;
  position: number;
  reason: string;
};

type MarketPageProps = {
  prices: PriceMap;
  selected: string;
  selectedPrice: number;
  selectedSignal: MarketSignal;
  search: string;
  items: [string, number][];
  history: History;
  chartPoints: ChartPoint[];
  updatedAt: string;

  onSearchChange: (value: string) => void;
  onSelect: (name: string) => void;

  getMarketSignal: (
    price: number,
    history: HistoryPoint[],
  ) => MarketSignal;
};

export default function MarketPage({
  prices,
  selected,
  selectedPrice,
  selectedSignal,
  search,
  items,
  history,
  chartPoints,
  updatedAt,
  onSearchChange,
  onSelect,
  getMarketSignal,
}: MarketPageProps) {
  return (
    <>
      <div className="metrics">
        <div className="metric">
          <span>Artigos</span>
          <strong>{Object.keys(prices).length}</strong>
        </div>

        <div className="metric">
          <span>Ativo selecionado</span>
          <strong>{selected}</strong>
        </div>

        <div className="metric">
          <span>Preço atual</span>
          <strong>{selectedPrice.toFixed(8)} FLOWER</strong>
        </div>

        <div className="metric">
          <span>Variação registrada</span>

          <strong
            className={
              selectedSignal.change > 0
                ? "positive"
                : selectedSignal.change < 0
                  ? "negative"
                  : "neutral"
            }
          >
            {selectedSignal.change > 0
              ? "▲ "
              : selectedSignal.change < 0
                ? "▼ "
                : "— "}

            {formatChange(selectedSignal.change)}
          </strong>
        </div>
      </div>

      <div className="market-grid">
        <section className="panel list-panel">
          <label>
            Buscar produto

            <input
              value={search}
              onChange={(event) =>
                onSearchChange(event.target.value)
              }
              placeholder="Gold, Wood, Stone..."
            />
          </label>

          <div className="item-list">
            {items.slice(0, 120).map(([name, price]) => {
              const signal = getMarketSignal(
                price,
                history[name] || [],
              );

              return (
                <button
                  type="button"
                  key={name}
                  className={selected === name ? "selected" : ""}
                  onClick={() => onSelect(name)}
                >
                  <div className="item-name">
                    <span>{name}</span>

                    <small
                      className={
                        signal.change > 0
                          ? "positive"
                          : signal.change < 0
                            ? "negative"
                            : "neutral"
                      }
                    >
                      {signal.change > 0
                        ? "▲ "
                        : signal.change < 0
                          ? "▼ "
                          : ""}

                      {formatChange(signal.change)}
                    </small>
                  </div>

                  <div className="item-price">
                    <strong>{price.toFixed(8)}</strong>

                    <span
                      className={`mini-signal ${signal.kind}`}
                    >
                      {signal.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel chart-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">ATIVO SELECIONADO</p>
              <h2>{selected}</h2>
            </div>

            <div className="price-summary">
              <div className="big-price">
                {selectedPrice.toFixed(8)}
                <small> FLOWER</small>
              </div>

              <span
                className={`change-badge ${
                  selectedSignal.change > 0
                    ? "positive"
                    : selectedSignal.change < 0
                      ? "negative"
                      : "neutral"
                }`}
              >
                {selectedSignal.change > 0
                  ? "▲ "
                  : selectedSignal.change < 0
                    ? "▼ "
                    : "— "}

                {formatChange(selectedSignal.change)}
              </span>
            </div>
          </div>

          <PriceChart points={chartPoints} />

          <div className="analysis-grid">
            <div className="signal-card">
              <span>Sinal atual</span>

              <strong
                className={`signal-label ${selectedSignal.kind}`}
              >
                {selectedSignal.label}
              </strong>
            </div>

            <div className="signal-card">
              <span>Confiança</span>
              <strong>{selectedSignal.confidence}%</strong>
            </div>

            <div className="signal-card">
              <span>Posição na faixa</span>
              <strong>{selectedSignal.position.toFixed(0)}%</strong>
            </div>
          </div>

          <div className="confidence-track">
            <div
              className={`confidence-fill ${selectedSignal.kind}`}
              style={{
                width: `${selectedSignal.confidence}%`,
              }}
            />
          </div>

          <div
            className={`analysis-callout ${selectedSignal.kind}`}
          >
            <strong>Análise automática</strong>
            <p>{selectedSignal.reason}</p>
          </div>

          <p className="caption">
            Última atualização:{" "}
            {updatedAt
              ? new Date(updatedAt).toLocaleString()
              : "—"}
            . Os sinais usam apenas o histórico salvo neste
            navegador e não garantem resultados futuros.
          </p>
        </section>
      </div>
    </>
  );
}

function formatChange(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}