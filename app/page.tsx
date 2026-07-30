"use client";

import { useEffect, useMemo, useState } from "react";
import PriceChart from "../components/PriceChart";
import { demoPrices, type MarketResponse, type PriceMap } from "../lib/market";

type History = Record<string, { time: number; price: number }[]>;

const coinItems = [
  { name: "Duskberry", coins: 1000 },
  { name: "Apple", coins: 20 },
  { name: "Radish", coins: 12 },
  { name: "Wheat", coins: 18 },
];

const recipes = [
  { name: "Gold Pickaxe", coins: 64, materials: [{ name: "Stone", qty: 5 }, { name: "Wood", qty: 3 }] },
  { name: "Iron Pickaxe", coins: 40, materials: [{ name: "Stone", qty: 3 }, { name: "Wood", qty: 2 }, { name: "Iron", qty: 1 }] },
];

export default function Home() {
  const [prices, setPrices] = useState<PriceMap>(demoPrices);
  const [selected, setSelected] = useState("Gold");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"loading" | "live" | "demo" | "error">("loading");
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [history, setHistory] = useState<History>({});
  const [tab, setTab] = useState<"market" | "craft" | "coins">("market");
  const [recipeName, setRecipeName] = useState(recipes[0].name);

  async function loadPrices() {
    setStatus("loading");
    try {
      const response = await fetch("/api/prices", { cache: "no-store" });
      const payload = (await response.json()) as MarketResponse;
      if (!response.ok || !payload.ok || !payload.prices) throw new Error(payload.error || "No se pudieron cargar los precios");
      setPrices(payload.prices);
      setUpdatedAt(payload.updatedAt || new Date().toISOString());
      setStatus("live");
      saveHistory(payload.prices);
    } catch {
      setStatus("demo");
      setUpdatedAt(new Date().toISOString());
      saveHistory(demoPrices);
    }
  }

  function saveHistory(nextPrices: PriceMap) {
    setHistory((current) => {
      const next = { ...current };
      const now = Date.now();
      for (const [name, price] of Object.entries(nextPrices)) {
        const existing = next[name] || [];
        next[name] = [...existing, { time: now, price }].slice(-180);
      }
      try { localStorage.setItem("smp-history", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("smp-history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
    loadPrices();
    const timer = window.setInterval(loadPrices, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const items = useMemo(() => Object.entries(prices)
    .filter(([name]) => name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a[0].localeCompare(b[0])), [prices, search]);

  const selectedPrice = prices[selected] ?? 0;
  const rawHistory = history[selected] || [];
  const chartPoints = (rawHistory.length > 1 ? rawHistory : Array.from({ length: 16 }, (_, i) => ({
    time: Date.now() - (15 - i) * 3600000,
    price: selectedPrice * (1 + Math.sin(i / 2.5) * 0.025 + (i - 8) * 0.001),
  }))).map((p) => ({ label: new Date(p.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), value: p.price }));

  const bestCoin = coinItems
    .filter((item) => prices[item.name])
    .map((item) => ({ ...item, cost: prices[item.name] / item.coins }))
    .sort((a, b) => a.cost - b.cost)[0];

  const recipe = recipes.find((item) => item.name === recipeName) || recipes[0];
  const materialCost = recipe.materials.reduce((sum, material) => sum + (prices[material.name] || 0) * material.qty, 0);
  const coinCost = bestCoin ? bestCoin.cost * recipe.coins : 0;
  const totalCraft = materialCost + coinCost;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span>🌻</span><div><strong>Sunflower</strong><small>Market Pro</small></div></div>
        <nav>
          <button className={tab === "market" ? "active" : ""} onClick={() => setTab("market")}>Mercado</button>
          <button className={tab === "craft" ? "active" : ""} onClick={() => setTab("craft")}>Crafting</button>
          <button className={tab === "coins" ? "active" : ""} onClick={() => setTab("coins")}>Coins</button>
        </nav>
        <div className="sidebar-note">
          <strong>{status === "live" ? "Mercado conectado" : status === "loading" ? "Conectando..." : "Modo demostración"}</strong>
          <span>Actualización automática cada 15 minutos.</span>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">SUNFLOWER LAND ANALYTICS</p><h1>{tab === "market" ? "Mercado" : tab === "craft" ? "Calculadora de crafting" : "Conversión de Coins"}</h1></div>
          <div className="status-area"><span className={`status ${status}`}>{status === "live" ? "● En vivo" : status === "loading" ? "● Cargando" : "● Demo"}</span><button onClick={loadPrices}>Actualizar</button></div>
        </header>

        {tab === "market" && <>
          <div className="metrics">
            <div className="metric"><span>Artículos</span><strong>{Object.keys(prices).length}</strong></div>
            <div className="metric"><span>Activo seleccionado</span><strong>{selected}</strong></div>
            <div className="metric"><span>Precio actual</span><strong>{selectedPrice.toFixed(8)} FLOWER</strong></div>
            <div className="metric"><span>Última actualización</span><strong>{updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—"}</strong></div>
          </div>

          <div className="market-grid">
            <section className="panel list-panel">
              <label>Buscar producto<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Gold, Wood, Stone..." /></label>
              <div className="item-list">
                {items.slice(0, 80).map(([name, price]) => <button key={name} className={selected === name ? "selected" : ""} onClick={() => setSelected(name)}><span>{name}</span><strong>{price.toFixed(8)}</strong></button>)}
              </div>
            </section>

            <section className="panel chart-panel">
              <div className="panel-title"><div><p className="eyebrow">ACTIVO SELECCIONADO</p><h2>{selected}</h2></div><div className="big-price">{selectedPrice.toFixed(8)}<small> FLOWER</small></div></div>
              <PriceChart points={chartPoints} />
              <p className="caption">El historial real se guarda desde la primera carga de cada navegador. Los datos de ejemplo solo aparecen cuando todavía no existen suficientes muestras.</p>
            </section>
          </div>
        </>}

        {tab === "craft" && <div className="two-col">
          <section className="panel form-panel">
            <label>Receta<select value={recipeName} onChange={(e) => setRecipeName(e.target.value)}>{recipes.map((r) => <option key={r.name}>{r.name}</option>)}</select></label>
            <div className="recipe-list">{recipe.materials.map((m) => <div key={m.name}><span>{m.qty} × {m.name}</span><strong>{((prices[m.name] || 0) * m.qty).toFixed(8)} FLOWER</strong></div>)}<div><span>{recipe.coins} Coins</span><strong>{coinCost.toFixed(8)} FLOWER</strong></div></div>
          </section>
          <section className="panel result-panel"><p className="eyebrow">COSTO ESTIMADO</p><h2>{totalCraft.toFixed(8)} FLOWER</h2><p>Materiales: {materialCost.toFixed(8)} FLOWER</p><p>Coins: {coinCost.toFixed(8)} FLOWER</p><div className="callout">Conversión de Coins basada en {bestCoin?.name || "la mejor opción disponible"}.</div></section>
        </div>}

        {tab === "coins" && <div className="two-col">
          <section className="panel"><p className="eyebrow">MEJOR OPCIÓN ACTUAL</p><h2>{bestCoin?.name || "Sin datos"}</h2><div className="big-price">{bestCoin ? bestCoin.cost.toFixed(10) : "—"}<small> FLOWER/Coin</small></div></section>
          <section className="panel"><h2>Ranking</h2><div className="recipe-list">{coinItems.filter((i) => prices[i.name]).map((i) => ({...i, cost: prices[i.name] / i.coins})).sort((a,b) => a.cost-b.cost).map((i, idx) => <div key={i.name}><span>#{idx + 1} {i.name}</span><strong>{i.cost.toFixed(10)}</strong></div>)}</div></section>
        </div>}
      </section>
    </main>
  );
}
