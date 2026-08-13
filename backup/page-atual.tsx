"use client";

import { useEffect, useMemo, useState } from "react";
import PriceChart from "../components/PriceChart";
import { demoPrices, type MarketResponse, type PriceMap } from "../lib/market";
import { coinItems, items as gameItems } from "../lib/gameData";
import Link from "next/link";
import { items } from "../lib/gameData";
import { getItemDetails } from "../lib";
import { DatabasePage } from "../components/Database";
import { DashboardPage } from "../components/Dashboard";
import { CraftsPage } from "../components/Crafts";

type HistoryPoint = { time: number; price: number };
type History = Record<string, HistoryPoint[]>;
type Tab =
  | "dashboard"
  | "database"
  | "crafts"
  | "farm"
  | "market"
  | "optimizer"
  | "deliveries"
  | "expansion"
  | "season"
  | "advisor"
  | "settings"
  | "coins";

type SignalKind = "buy" | "hold" | "sell";

type MarketSignal = {
  label: "COMPRAR" | "MANTER" | "VENDER";
  kind: SignalKind;
  confidence: number;
  change: number;
  position: number;
  reason: string;
};

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

function calculateCoinRanking(
  coinItems: { name: string; coins: number }[],
  prices: PriceMap,
  requiredCoins: number,
) {
  const safeCoins = Math.max(1, Math.floor(requiredCoins));

  return coinItems
    .filter(
  (item) =>
    prices[item.name] !== undefined &&
    item.coins > 0
)
    .map((item) => {
      const unitPrice = prices[item.name] || 0;
      const quantity = Math.ceil(safeCoins / item.coins);
      const totalCoins = quantity * item.coins;

      return {
        ...item,
        unitPrice,
        quantity,
        totalCoins,
        totalFlower: quantity * unitPrice,
        flowerPerCoin: unitPrice / item.coins,
        leftover: totalCoins - safeCoins,
      };
    })
    .sort((a, b) => {
      if (a.totalFlower !== b.totalFlower) {
        return a.totalFlower - b.totalFlower;
      }

      return a.leftover - b.leftover;
    });
}

export default function Home() {
  const [prices, setPrices] = useState<PriceMap>(demoPrices);
  const [selected, setSelected] = useState("Gold");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"loading" | "live" | "demo">("loading");
  const [updatedAt, setUpdatedAt] = useState("");
  const [history, setHistory] = useState<History>({});
  const [tab, setTab] = useState<Tab>("dashboard");
  const [recipeName, setRecipeName] = useState(recipes[0].name);
  const [targetCoins, setTargetCoins] = useState(1000);
  const sunflower = getItemDetails("sunflower");

    console.log("Teste:", sunflower);

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

  const coinRanking = calculateCoinRanking(coinItems, prices, targetCoins);
  const bestCoin = coinRanking[0];
  const recipe = recipes.find((item) => item.name === recipeName) || recipes[0];
  const materialCost = recipe.materials.reduce(
    (sum, material) => sum + (prices[material.name] || 0) * material.qty,
    0,
  );
  const craftCoinRanking = calculateCoinRanking(coinItems, prices, recipe.coins);
  const bestCraftCoin = craftCoinRanking[0];
  const coinCost = bestCraftCoin?.totalFlower || 0;
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
          <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>▦ Dashboard</button>
          <button className={tab === "farm" ? "active" : ""} onClick={() => setTab("farm")}>🌻 Minha Fazenda</button>
          <button className={tab === "market" ? "active" : ""} onClick={() => setTab("market")}>📈 Mercado</button>
          <button className={tab === "optimizer" ? "active" : ""} onClick={() => setTab("optimizer")}>⚡ Optimizer</button>
          <button className={tab === "crafts" ? "active" : ""} onClick={() => setTab("crafts")}>⚒️ Crafting</button>
          <button className={tab === "coins" ? "active" : ""} onClick={() => setTab("coins")}>🪙 Coins / FLOWER</button>
          <button className={tab === "deliveries" ? "active" : ""} onClick={() => setTab("deliveries")}>📦 Entregas</button>
          <button className={tab === "expansion" ? "active" : ""} onClick={() => setTab("expansion")}>🗺️ Expansão</button>
          <button className={tab === "season" ? "active" : ""} onClick={() => setTab("season")}>🏆 Temporada</button>
          <button className={tab === "advisor" ? "active" : ""} onClick={() => setTab("advisor")}>✦ AI Advisor</button>
          <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>⚙ Configurações</button>
          <button
  className={tab === "database" ? "active" : ""}
  onClick={() => setTab("database")}
>
  📚 Banco de Itens
</button>
</nav>

<div className="sidebar-note">
  <strong>
    {status === "live"
      ? "Mercado conectado"
      : status === "loading"
        ? "Conectando..."
        : "Modo demonstração"}
  </strong>

  <span>Atualização automática a cada 15 minutos.</span>
</div>
</aside>

<section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">SUNFLOWER LAND ANALYTICS</p>
            <h1>{({
              dashboard: "Dashboard",
              farm: "Minha Fazenda",
              market: "Mercado",
              optimizer: "Daily Optimizer",
              crafts: "Banco de Crafts",
              deliveries: "Planejador de entregas",
              expansion: "Expansion Planner",
              season: "Season Planner",
              advisor: "AI Advisor",
              settings: "Configurações",
              coins: "Conversão de Coins",
            } as Record<Tab, string>)[tab]}</h1>
          </div>
          <div className="status-area">
            <span className={`status ${status}`}>{status === "live" ? "● Em tempo real" : status === "loading" ? "● Carregando" : "● Demo"}</span>
            <button onClick={() => void loadPrices()}>Atualizar</button>
          </div>
        </header>

       {tab === "database" && <DatabasePage />}

        {tab === "dashboard" && (
          <DashboardPage
            onNavigate={(nextTab) => setTab(nextTab as Tab)}
          />
        )}

        {tab === "crafts" && <CraftsPage />}
      </section>
    </main>
  );
}