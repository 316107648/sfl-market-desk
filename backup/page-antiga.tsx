"use client";

import { useEffect, useMemo, useState } from "react";
import PriceChart from "../components/PriceChart";
import { demoPrices, type MarketResponse, type PriceMap } from "../lib/market";

type HistoryPoint = { time: number; price: number };
type History = Record<string, HistoryPoint[]>;
type Tab = "market" | "craft" | "coins";
type SignalKind = "buy" | "hold" | "sell";

type MarketSignal = {
  label: "COMPRAR" | "MANTER" | "VENDER";
  kind: SignalKind;
  confidence: number;
  change: number;
  position: number;
  reason: string;
};

const coinItems = [
  { name: "Duskberry", coins: 1000 },
  { name: "Apple", coins: 20 },
  { name: "Radish", coins: 12 },
  { name: "Wheat", coins: 18 },
];

const recipes = [
  {
    name: "Gold Pickaxe",
    coins: 64,
    materials: [
      { name: "Stone", qty: 5 },
      { name: "Wood", qty: 3 },
    ],
  },
  {
    name: "Iron Pickaxe",
    coins: 40,
    materials: [
      { name: "Stone", qty: 3 },
      { name: "Wood", qty: 2 },
      { name: "Iron", qty: 1 },
    ],
  },
];

function percentChange(points: HistoryPoint[]): number {
  if (points.length < 2) return 0;
  const first = points[0].price;
  const last = points[points.length - 1].price;
  return first > 0 ? ((last - first) / first) * 100 : 0;
}

function marketSignal(current: number, points: HistoryPoint[]): MarketSignal {
  if (!current || points.length < 2) {
    return {
      label: "MANTER",
      kind: "hold",
      confidence: 50,
      change: 0,
      position: 50,
      reason: "Ainda não há histórico suficiente para calcular uma tendência real.",
    };
  }

  const values = points.map((point) => point.price);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const change = percentChange(points);
  const range = maximum - minimum;
  const position = range > 0 ? ((current - minimum) / range) * 100 : 50;
  const distanceFromAverage = average > 0 ? ((current - average) / average) * 100 : 0;

  let score = 0;
  const reasons: string[] = [];

  if (position <= 25) {
    score += 2;
    reasons.push("está próximo do mínimo recente");
  } else if (position <= 40) {
    score += 1;
    reasons.push("está na parte baixa da faixa recente");
  } else if (position >= 75) {
    score -= 2;
    reasons.push("está próximo do máximo recente");
  } else if (position >= 60) {
    score -= 1;
    reasons.push("está na parte alta da faixa recente");
  }

  if (distanceFromAverage <= -5) {
    score += 1;
    reasons.push("está abaixo da média");
  } else if (distanceFromAverage >= 5) {
    score -= 1;
    reasons.push("está acima da média");
  }

  if (change > 8) {
    score -= 1;
    reasons.push("subiu rapidamente");
  } else if (change < -8) {
    score += 1;
    reasons.push("caiu bastante no período");
  }

  if (score >= 2) {
    return {
      label: "COMPRAR",
      kind: "buy",
      confidence: Math.min(92, 58 + score * 8),
      change,
      position,
      reason: `Sinal estatístico de compra: o preço ${reasons.join(" e ")}.`,
    };
  }

  if (score <= -2) {
    return {
      label: "VENDER",
      kind: "sell",
      confidence: Math.min(92, 58 + Math.abs(score) * 8),
      change,
      position,
      reason: `Sinal estatístico de venda: o preço ${reasons.join(" e ")}.`,
    };
  }

  return {
    label: "MANTER",
    kind: "hold",
    confidence: 58,
    change,
    position,
    reason: reasons.length
      ? `Os indicadores estão mistos: o preço ${reasons.join(" e ")}.`
      : "O preço está perto da média e ainda não apresenta direção clara.",
  };
}

function formatChange(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function Home() {
  const [prices, setPrices] = useState<PriceMap>(demoPrices);
  const [selected, setSelected] = useState("Gold");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"loading" | "live" | "demo">("loading");
  const [updatedAt, setUpdatedAt] = useState("");
  const [history, setHistory] = useState<History>({});
  const [tab, setTab] = useState<Tab>("market");
  const [recipeName, setRecipeName] = useState(recipes[0].name);

  function saveHistory(nextPrices: PriceMap) {
    setHistory((current) => {
      const next: History = { ...current };
      const now = Date.now();

      Object.entries(nextPrices).forEach(([name, price]) => {
        const existing = next[name] || [];
        const last = existing[existing.length - 1];
        if (last && last.price === price && now - last.time < 60_000) return;
        next[name] = [...existing, { time: now, price }].slice(-500);
      });

      try {
        localStorage.setItem("smp-history", JSON.stringify(next));
      } catch {
        // O site continua funcionando caso o navegador bloqueie o armazenamento.
      }
      return next;
    });
  }

  async function loadPrices() {
    setStatus("loading");
    try {
      const response = await fetch("/api/prices", { cache: "no-store" });
      const payload = (await response.json()) as MarketResponse;
      if (!response.ok || !payload.ok || !payload.prices) {
        throw new Error(payload.error || "Falha ao carregar preços");
      }
      setPrices(payload.prices);
      setUpdatedAt(payload.updatedAt || new Date().toISOString());
      setStatus("live");
      saveHistory(payload.prices);
    } catch {
      setPrices(demoPrices);
      setUpdatedAt(new Date().toISOString());
      setStatus("demo");
      saveHistory(demoPrices);
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("smp-history");
      if (saved) setHistory(JSON.parse(saved) as History);
    } catch {
      // Ignora histórico inválido.
    }

    void loadPrices();
    const timer = window.setInterval(() => void loadPrices(), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const items = useMemo(
    () =>
      Object.entries(prices)
        .filter(([name]) => name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a[0].localeCompare(b[0])),
    [prices, search],
  );

  const selectedPrice = prices[selected] || 0;
  const selectedHistory = history[selected] || [];
  const selectedSignal = marketSignal(selectedPrice, selectedHistory);

  const chartHistory =
    selectedHistory.length >= 2
      ? selectedHistory
      : Array.from({ length: 16 }, (_, index) => ({
          time: Date.now() - (15 - index) * 3_600_000,
          price: selectedPrice * (1 + Math.sin(index / 2.6) * 0.02),
        }));

  const chartPoints = chartHistory.map((point) => ({
    label: new Date(point.time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    value: point.price,
  }));

  const coinRanking = coinItems
    .filter((item) => prices[item.name])
    .map((item) => ({ ...item, cost: prices[item.name] / item.coins }))
    .sort((a, b) => a.cost - b.cost);

  const bestCoin = coinRanking[0];
  const recipe = recipes.find((item) => item.name === recipeName) || recipes[0];
  const materialCost = recipe.materials.reduce(
    (sum, material) => sum + (prices[material.name] || 0) * material.qty,
    0,
  );
  const coinCost = bestCoin ? bestCoin.cost * recipe.coins : 0;
  const totalCraft = materialCost + coinCost;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">🌻</span>
          <div>
            <strong>Sunflower</strong>
            <small>Market Pro</small>
          </div>
        </div>

        <nav>
          <button className={tab === "market" ? "active" : ""} onClick={() => setTab("market")}>📈 Mercado</button>
          <button className={tab === "craft" ? "active" : ""} onClick={() => setTab("craft")}>⚒️ Crafting</button>
          <button className={tab === "coins" ? "active" : ""} onClick={() => setTab("coins")}>🪙 Coins</button>
        </nav>

        <div className="sidebar-note">
          <strong>{status === "live" ? "Mercado conectado" : status === "loading" ? "Conectando..." : "Modo demonstração"}</strong>
          <span>Atualização automática a cada 15 minutos.</span>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">SUNFLOWER LAND ANALYTICS</p>
            <h1>{tab === "market" ? "Mercado" : tab === "craft" ? "Calculadora de crafting" : "Conversão de Coins"}</h1>
          </div>
          <div className="status-area">
            <span className={`status ${status}`}>{status === "live" ? "● Em tempo real" : status === "loading" ? "● Carregando" : "● Demo"}</span>
            <button onClick={() => void loadPrices()}>Atualizar</button>
          </div>
        </header>

        {tab === "market" && (
          <>
            <div className="metrics">
              <div className="metric"><span>Artigos</span><strong>{Object.keys(prices).length}</strong></div>
              <div className="metric"><span>Ativo selecionado</span><strong>{selected}</strong></div>
              <div className="metric"><span>Preço atual</span><strong>{selectedPrice.toFixed(8)} FLOWER</strong></div>
              <div className="metric">
                <span>Variação registrada</span>
                <strong className={selectedSignal.change > 0 ? "positive" : selectedSignal.change < 0 ? "negative" : "neutral"}>
                  {selectedSignal.change > 0 ? "▲ " : selectedSignal.change < 0 ? "▼ " : "— "}{formatChange(selectedSignal.change)}
                </strong>
              </div>
            </div>

            <div className="market-grid">
              <section className="panel list-panel">
                <label>
                  Buscar produto
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Gold, Wood, Stone..." />
                </label>

                <div className="item-list">
                  {items.slice(0, 120).map(([name, price]) => {
                    const signal = marketSignal(price, history[name] || []);
                    return (
                      <button key={name} className={selected === name ? "selected" : ""} onClick={() => setSelected(name)}>
                        <div className="item-name">
                          <span>{name}</span>
                          <small className={signal.change > 0 ? "positive" : signal.change < 0 ? "negative" : "neutral"}>
                            {signal.change > 0 ? "▲ " : signal.change < 0 ? "▼ " : ""}{formatChange(signal.change)}
                          </small>
                        </div>
                        <div className="item-price">
                          <strong>{price.toFixed(8)}</strong>
                          <span className={`mini-signal ${signal.kind}`}>{signal.label}</span>
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
                    <div className="big-price">{selectedPrice.toFixed(8)}<small> FLOWER</small></div>
                    <span className={`change-badge ${selectedSignal.change > 0 ? "positive" : selectedSignal.change < 0 ? "negative" : "neutral"}`}>
                      {selectedSignal.change > 0 ? "▲ " : selectedSignal.change < 0 ? "▼ " : "— "}{formatChange(selectedSignal.change)}
                    </span>
                  </div>
                </div>

                <PriceChart points={chartPoints} />

                <div className="analysis-grid">
                  <div className="signal-card"><span>Sinal atual</span><strong className={`signal-label ${selectedSignal.kind}`}>{selectedSignal.label}</strong></div>
                  <div className="signal-card"><span>Confiança</span><strong>{selectedSignal.confidence}%</strong></div>
                  <div className="signal-card"><span>Posição na faixa</span><strong>{selectedSignal.position.toFixed(0)}%</strong></div>
                </div>

                <div className="confidence-track"><div className={`confidence-fill ${selectedSignal.kind}`} style={{ width: `${selectedSignal.confidence}%` }} /></div>

                <div className={`analysis-callout ${selectedSignal.kind}`}>
                  <strong>Análise automática</strong>
                  <p>{selectedSignal.reason}</p>
                </div>

                <p className="caption">
                  Última atualização: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}. Os sinais usam apenas o histórico salvo neste navegador e não garantem resultados futuros.
                </p>
              </section>
            </div>
          </>
        )}

        {tab === "craft" && (
          <div className="two-col">
            <section className="panel form-panel">
              <label>
                Receita
                <select value={recipeName} onChange={(event) => setRecipeName(event.target.value)}>
                  {recipes.map((item) => <option key={item.name}>{item.name}</option>)}
                </select>
              </label>
              <div className="recipe-list">
                {recipe.materials.map((material) => (
                  <div key={material.name}><span>{material.qty} × {material.name}</span><strong>{((prices[material.name] || 0) * material.qty).toFixed(8)} FLOWER</strong></div>
                ))}
                <div><span>{recipe.coins} Coins</span><strong>{coinCost.toFixed(8)} FLOWER</strong></div>
              </div>
            </section>

            <section className="panel result-panel">
              <p className="eyebrow">CUSTO ESTIMADO</p>
              <h2>{totalCraft.toFixed(8)} FLOWER</h2>
              <p>Materiais: {materialCost.toFixed(8)} FLOWER</p>
              <p>Coins: {coinCost.toFixed(8)} FLOWER</p>
              <div className="callout">Conversão de Coins baseada em {bestCoin?.name || "a melhor opção disponível"}.</div>
            </section>
          </div>
        )}

        {tab === "coins" && (
          <div className="two-col">
            <section className="panel">
              <p className="eyebrow">MELHOR OPÇÃO ATUAL</p>
              <h2>{bestCoin?.name || "Sem dados"}</h2>
              <div className="big-price">{bestCoin ? bestCoin.cost.toFixed(10) : "—"}<small> FLOWER/Coin</small></div>
            </section>
            <section className="panel">
              <h2>Ranking</h2>
              <div className="recipe-list">
                {coinRanking.map((item, index) => (
                  <div key={item.name}><span>#{index + 1} {item.name}</span><strong>{item.cost.toFixed(10)}</strong></div>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
