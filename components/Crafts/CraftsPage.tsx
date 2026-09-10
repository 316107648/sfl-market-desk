"use client";

import { useEffect, useMemo, useState } from "react";
import type { PriceMap } from "../../lib/market";
import { crafts } from "../../lib/gameData";
import CraftCard from "./CraftCard";
import { loadStoredFarmSnapshot, type StoredFarmSnapshot } from "../../lib/farm";
import { calculateResourcePlan, resourcePlans, type ResourcePlanId } from "../../lib/services/resourceOptimizer";
import { calculateCoinExchange } from "../../lib/services/coinExchange";

type CraftsPageProps = {
  prices: PriceMap;
};

export type CraftEconomics = {
  materialCost: number;
  grossRevenue: number;
  netRevenue: number;
  profit: number;
  marginPct: number | null;
  profitPerHour: number | null;
  complete: boolean;
  missingPrices: string[];
};

function priceFor(prices: PriceMap, name: string): number | undefined {
  if (prices[name] !== undefined) return prices[name];
  const target = name.trim().toLowerCase();
  const entry = Object.entries(prices).find(([key]) => key.trim().toLowerCase() === target);
  return entry?.[1];
}

function calculateEconomics(
  craft: (typeof crafts)[number],
  prices: PriceMap,
  feePct: number,
  quantity = 1,
): CraftEconomics {
  const missingPrices: string[] = [];
  let materialCost = 0;

  for (const ingredient of craft.ingredients) {
    const ingredientPrice = priceFor(prices, ingredient.itemId);
    if (ingredientPrice === undefined) {
      missingPrices.push(ingredient.itemId);
      continue;
    }
    materialCost += ingredientPrice * ingredient.amount * quantity;
  }

  const outputPrice = priceFor(prices, craft.name);
  if (outputPrice === undefined) missingPrices.push(craft.name);

  const grossRevenue = (outputPrice ?? 0) * quantity;
  const fee = Math.max(0, Math.min(100, feePct)) / 100;
  const netRevenue = grossRevenue * (1 - fee);
  const profit = netRevenue - materialCost;
  const marginPct = materialCost > 0 ? (profit / materialCost) * 100 : null;
  const totalSeconds = (craft.craftingTimeSeconds ?? 0) * quantity;
  const profitPerHour = totalSeconds > 0 ? profit / (totalSeconds / 3600) : null;

  return {
    materialCost,
    grossRevenue,
    netRevenue,
    profit,
    marginPct,
    profitPerHour,
    complete: missingPrices.length === 0,
    missingPrices: Array.from(new Set(missingPrices)),
  };
}

export default function CraftsPage({ prices }: CraftsPageProps) {
  const [search, setSearch] = useState("");
  const [building, setBuilding] = useState("all");
  const [feePct, setFeePct] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [sort, setSort] = useState<"profit" | "margin" | "hour" | "name">("profit");
  const marketNames = useMemo(() => Object.keys(prices).sort((a, b) => a.localeCompare(b)), [prices]);
  const [manualOutput, setManualOutput] = useState("");
  const [manualOutputQty, setManualOutputQty] = useState(1);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [manualIngredients, setManualIngredients] = useState([{ item: "", amount: 1 }]);

  const [farmSnapshot, setFarmSnapshot] = useState<StoredFarmSnapshot | null>(null);
  const [resourcePlanId, setResourcePlanId] = useState<ResourcePlanId>("pickaxe-to-stone");
  const [resourceToolCount, setResourceToolCount] = useState(1);
  const [resourceYield, setResourceYield] = useState(2.6);
  const [resourceCoinCost, setResourceCoinCost] = useState(20);
  const [buyFeePct, setBuyFeePct] = useState(0);
  const [coinFlowerRate, setCoinFlowerRate] = useState(0);
  const [coinRateMode, setCoinRateMode] = useState<"auto" | "manual">("auto");
  const [npcCoinMultiplier, setNpcCoinMultiplier] = useState(1);

  useEffect(() => {
    setFarmSnapshot(loadStoredFarmSnapshot());
  }, []);


  const coinExchange = useMemo(
    () => calculateCoinExchange(prices, buyFeePct, npcCoinMultiplier),
    [prices, buyFeePct, npcCoinMultiplier],
  );

  const effectiveCoinFlowerRate = coinRateMode === "auto"
    ? (coinExchange.best?.flowerPerCoin ?? 0)
    : coinFlowerRate;

  const resourcePlan = useMemo(
    () => resourcePlans.find((plan) => plan.id === resourcePlanId) ?? resourcePlans[0],
    [resourcePlanId],
  );

  useEffect(() => {
    setResourceYield(1.5);
    const nextPlan = resourcePlans.find((plan) => plan.id === resourcePlanId);
    setResourceCoinCost(nextPlan?.coinCost ?? 0);
  }, [resourcePlanId]);

  const resourceAnalysis = useMemo(() => calculateResourcePlan({
    plan: { ...resourcePlan, coinCost: resourceCoinCost },
    prices,
    saleFeePct: feePct,
    buyFeePct,
    coinFlowerRate: effectiveCoinFlowerRate,
    effectiveYield: resourceYield,
    toolCount: resourceToolCount,
    snapshot: farmSnapshot,
  }), [resourcePlan, resourceCoinCost, prices, feePct, buyFeePct, effectiveCoinFlowerRate, resourceYield, resourceToolCount, farmSnapshot]);

  const buildings = useMemo(() => {
    return Array.from(
      new Set(
        crafts
          .map((craft) => craft.building)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort();
  }, []);

  const evaluatedCrafts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return crafts
      .filter((craft) => {
        const matchesSearch =
          normalizedSearch === "" ||
          craft.name.toLowerCase().includes(normalizedSearch) ||
          craft.ingredients.some((ingredient) =>
            ingredient.itemId.toLowerCase().includes(normalizedSearch),
          );

        const matchesBuilding = building === "all" || craft.building === building;
        return matchesSearch && matchesBuilding;
      })
      .map((craft) => ({
        craft,
        economics: calculateEconomics(craft, prices, feePct, quantity),
      }))
      .sort((a, b) => {
        if (sort === "name") return a.craft.name.localeCompare(b.craft.name);
        if (sort === "margin") return (b.economics.marginPct ?? -Infinity) - (a.economics.marginPct ?? -Infinity);
        if (sort === "hour") return (b.economics.profitPerHour ?? -Infinity) - (a.economics.profitPerHour ?? -Infinity);
        return b.economics.profit - a.economics.profit;
      });
  }, [search, building, prices, feePct, quantity, sort]);

  const manualEconomics = useMemo(() => {
    const outputPrice = manualOutput ? priceFor(prices, manualOutput) : undefined;
    let cost = 0;
    let complete = Boolean(manualOutput && outputPrice !== undefined);
    for (const ingredient of manualIngredients) {
      if (!ingredient.item) { complete = false; continue; }
      const value = priceFor(prices, ingredient.item);
      if (value === undefined) { complete = false; continue; }
      cost += value * Math.max(0, ingredient.amount);
    }
    const gross = (outputPrice ?? 0) * Math.max(1, manualOutputQty);
    const net = gross * (1 - Math.max(0, Math.min(100, feePct)) / 100);
    const profit = net - cost;
    const margin = cost > 0 ? (profit / cost) * 100 : null;
    const perHour = manualMinutes > 0 ? profit / (manualMinutes / 60) : null;
    return { cost, gross, net, profit, margin, perHour, complete };
  }, [prices, manualOutput, manualOutputQty, manualMinutes, manualIngredients, feePct]);

  const summary = useMemo(() => {
    const complete = evaluatedCrafts.filter(({ economics }) => economics.complete);
    const profitable = complete.filter(({ economics }) => economics.profit > 0);
    const best = profitable.reduce<(typeof evaluatedCrafts)[number] | null>((current, candidate) => {
      if (!current || candidate.economics.profit > current.economics.profit) return candidate;
      return current;
    }, null);
    return { complete: complete.length, profitable: profitable.length, best };
  }, [evaluatedCrafts]);

  return (
    <div className="crafts-page craft-profit-page">
      <div className="database-header">
        <div>
          <p className="database-label">Sunflower Land</p>
          <h2>Calculadora de Craft</h2>
          <p>
            Compare o custo dos ingredientes com o valor de venda do item pronto e veja se vale a pena craftar.
          </p>
        </div>

        <div className="database-total">
          <strong>{evaluatedCrafts.length}</strong>
          <span>crafts analisados</span>
        </div>
      </div>

      <div className="craft-profit-kpis">
        <div className="panel">
          <small>Com preços completos</small>
          <strong>{summary.complete}</strong>
        </div>
        <div className="panel">
          <small>Lucrativos agora</small>
          <strong>{summary.profitable}</strong>
        </div>
        <div className="panel">
          <small>Melhor oportunidade</small>
          <strong>{summary.best?.craft.name ?? "—"}</strong>
        </div>
        <div className="panel">
          <small>Lucro do melhor</small>
          <strong>{summary.best ? `${summary.best.economics.profit.toFixed(6)} FLOWER` : "—"}</strong>
        </div>
      </div>

      <div className="craft-profit-controls panel">
        <label>
          Quantidade
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
          />
        </label>
        <label>
          Taxa de venda (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={feePct}
            onChange={(event) => setFeePct(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
          />
        </label>
        <label>
          Ordenar por
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="profit">Maior lucro</option>
            <option value="margin">Maior margem</option>
            <option value="hour">Maior lucro/hora</option>
            <option value="name">Nome</option>
          </select>
        </label>
        <div className="craft-profit-note">
          <strong>Como calculamos</strong>
          <span>Venda líquida − valor de mercado dos ingredientes. A taxa é opcional e pode representar sua taxa real de venda.</span>
        </div>
      </div>


      <section className="resource-optimizer panel resource-optimizer-simple compact-tool-shop">
        <div className="compact-tool-head">
          <div>
            <span className="database-label">FERRAMENTAS</span>
            <h3>Craftar para coletar / minerar</h3>
          </div>
          <label>
            Quantidade
            <input type="number" min="1" step="1" value={resourceToolCount} onChange={(event) => setResourceToolCount(Math.max(1, Math.floor(Number(event.target.value) || 1)))} />
          </label>
        </div>

        <div className="compact-tool-layout">
          <div className="compact-tool-list">
            {resourcePlans.map((plan) => (
              <button
                type="button"
                key={plan.id}
                className={`compact-tool-button ${resourcePlanId === plan.id ? "active" : ""}`}
                onClick={() => setResourcePlanId(plan.id)}
              >
                <span>{plan.icon}</span>
                <div><strong>{plan.tool}</strong><small>→ {plan.target}</small></div>
              </button>
            ))}
          </div>

          {(() => {
            const buyFactor = 1 + Math.max(0, buyFeePct) / 100;
            const buyAllMaterials = resourceAnalysis.ingredientRows.reduce((sum, row) => sum + (row.price ?? 0) * row.needed * buyFactor, 0);
            const buyAllTotal = buyAllMaterials + resourceAnalysis.coinCostFlower;
            const targetPrice = priceFor(prices, resourcePlan.target) ?? 0;
            const netUnitSale = targetPrice * (1 - Math.max(0, Math.min(100, feePct)) / 100);
            const breakEvenTotal = netUnitSale > 0 ? buyAllTotal / netUnitSale : 0;
            const breakEvenPerTool = breakEvenTotal / Math.max(1, resourceToolCount);
            const saleFeeAtBreakEven = breakEvenTotal * targetPrice * (Math.max(0, Math.min(100, feePct)) / 100);
            return (
              <div className="compact-tool-detail">
                <div className="compact-tool-title">
                  <div className="tool-icon">{resourcePlan.icon}</div>
                  <div>
                    <small>FERRAMENTA</small>
                    <h3>{resourcePlan.tool}</h3>
                    <p>Usada para obter <strong>{resourcePlan.target}</strong></p>
                    <span className="tool-recipe-source">{resourcePlan.sourceNote}</span>
                  </div>
                </div>

                <div className="compact-recipe-row">
                  <span>Para craftar:</span>
                  {resourcePlan.ingredients.map((ingredient) => (
                    <strong key={ingredient.name}>{ingredient.amount * resourceToolCount} {ingredient.name}</strong>
                  ))}
                  <strong>{resourceCoinCost * resourceToolCount} Coins</strong>
                </div>

                <div className="compact-money-grid">
                  <div>
                    <small>CUSTO ECONÔMICO</small>
                    <strong>{buyAllTotal.toFixed(6)} FLOWER</strong>
                    <span>comprando/valorando todos os materiais</span>
                  </div>
                  <div className="break-even-box">
                    <small>PRECISA RENDER PELO MENOS</small>
                    <strong>{netUnitSale > 0 ? `${breakEvenPerTool.toFixed(2)} ${resourcePlan.target}` : "sem preço"}</strong>
                    <span>por ferramenta para se pagar</span>
                  </div>
                </div>

                {netUnitSale > 0 && (
                  <div className="compact-breakdown">
                    <span>Com {resourceToolCount} ferramenta(s): <strong>{breakEvenTotal.toFixed(2)} {resourcePlan.target}</strong> no total</span>
                    <span>Preço atual: <strong>{targetPrice.toFixed(6)} FLOWER/{resourcePlan.target}</strong></span>
                    <span>Taxa de venda: <strong>{feePct.toFixed(1)}%</strong></span>
                    <span>Venda bruta no empate: <strong>{(breakEvenTotal * targetPrice).toFixed(6)} FLOWER</strong></span>
                    <span>Taxa no empate: <strong>-{saleFeeAtBreakEven.toFixed(6)} FLOWER</strong></span>
                    <span>Recebe líquido: <strong>{buyAllTotal.toFixed(6)} FLOWER</strong></span>
                  </div>
                )}

                {farmSnapshot && (
                  <div className="inventory-outlay">No seu inventário, o desembolso estimado para completar o craft é <strong>{resourceAnalysis.craftCashOutlay.toFixed(6)} FLOWER</strong>.</div>
                )}
                {!resourceAnalysis.complete && <div className="craft-missing">Faltam preços: {resourceAnalysis.missingPrices.join(", ")}</div>}
              </div>
            );
          })()}
        </div>

        <details className="tool-advanced">
          <summary>⚙️ Ajustes e cálculo dos Coins</summary>
          <div className="resource-optimizer-controls compact">
            <label>
              Coins por ferramenta
              <input type="number" min="0" step="1" value={resourceCoinCost} onChange={(event) => setResourceCoinCost(Math.max(0, Number(event.target.value) || 0))} />
            </label>
            <label>
              Taxa/spread de compra (%)
              <input type="number" min="0" max="100" step="0.1" value={buyFeePct} onChange={(event) => setBuyFeePct(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} />
            </label>
            <label>
              Conversão de Coins
              <select value={coinRateMode} onChange={(event) => setCoinRateMode(event.target.value as "auto" | "manual")}>
                <option value="auto">Automática — melhor item → NPC</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            {coinRateMode === "manual" ? (
              <label>
                1 Coin em FLOWER
                <input type="number" min="0" step="0.00000001" value={coinFlowerRate} onChange={(event) => setCoinFlowerRate(Math.max(0, Number(event.target.value) || 0))} />
              </label>
            ) : (
              <label>
                Bônus de Coins no NPC
                <input type="number" min="0.01" step="0.01" value={npcCoinMultiplier} onChange={(event) => setNpcCoinMultiplier(Math.max(0.01, Number(event.target.value) || 1))} />
              </label>
            )}
          </div>
          <div className="coin-simple-line">
            <span>🪙 Coin usado no cálculo</span>
            <strong>{effectiveCoinFlowerRate > 0 ? `1 Coin = ${effectiveCoinFlowerRate.toFixed(8)} FLOWER` : "sem conversão"}</strong>
            {coinRateMode === "auto" && coinExchange.best && <small>Melhor conversão atual: {coinExchange.best.name}</small>}
          </div>
        </details>
      </section>

      <section className="craft-manual panel">
        <div className="craft-manual-head">
          <div>
            <span className="database-label">CALCULADORA RÁPIDA</span>
            <h3>Monte qualquer craft manualmente</h3>
            <p>Útil enquanto ampliamos o banco oficial de receitas. Escolha o item final e os materiais usando os preços atuais.</p>
          </div>
          <span className={`craft-verdict ${!manualEconomics.complete ? "unknown" : manualEconomics.profit > 0 ? "positive" : manualEconomics.profit < 0 ? "negative" : "neutral"}`}>
            {!manualEconomics.complete ? "PREENCHA OS DADOS" : manualEconomics.profit > 0 ? "VALE CRAFTAR" : manualEconomics.profit < 0 ? "MELHOR NÃO" : "EMPATE"}
          </span>
        </div>

        <div className="craft-manual-grid">
          <label>
            Item produzido
            <select value={manualOutput} onChange={(event) => setManualOutput(event.target.value)}>
              <option value="">Selecione...</option>
              {marketNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>
            Quantidade produzida
            <input type="number" min="1" step="1" value={manualOutputQty} onChange={(event) => setManualOutputQty(Math.max(1, Number(event.target.value) || 1))} />
          </label>
          <label>
            Tempo total (min)
            <input type="number" min="0" step="1" value={manualMinutes} onChange={(event) => setManualMinutes(Math.max(0, Number(event.target.value) || 0))} />
          </label>
        </div>

        <div className="craft-manual-ingredients">
          <div className="craft-manual-title-row"><strong>Ingredientes</strong><button type="button" onClick={() => setManualIngredients((items) => [...items, { item: "", amount: 1 }])}>+ Ingrediente</button></div>
          {manualIngredients.map((ingredient, index) => (
            <div className="craft-manual-ingredient" key={`manual-${index}`}>
              <select value={ingredient.item} onChange={(event) => setManualIngredients((items) => items.map((row, rowIndex) => rowIndex === index ? { ...row, item: event.target.value } : row))}>
                <option value="">Selecione o material...</option>
                {marketNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <input type="number" min="0" step="0.01" value={ingredient.amount} onChange={(event) => setManualIngredients((items) => items.map((row, rowIndex) => rowIndex === index ? { ...row, amount: Math.max(0, Number(event.target.value) || 0) } : row))} />
              <span>{ingredient.item && priceFor(prices, ingredient.item) !== undefined ? `${((priceFor(prices, ingredient.item) ?? 0) * ingredient.amount).toFixed(6)} FLOWER` : "—"}</span>
              <button type="button" disabled={manualIngredients.length === 1} onClick={() => setManualIngredients((items) => items.filter((_, rowIndex) => rowIndex !== index))}>×</button>
            </div>
          ))}
        </div>

        <div className="craft-manual-result">
          <div><span>Custo</span><strong>{manualEconomics.cost.toFixed(6)} FLOWER</strong></div>
          <div><span>Venda líquida</span><strong>{manualEconomics.net.toFixed(6)} FLOWER</strong></div>
          <div><span>Lucro / prejuízo</span><strong>{manualEconomics.complete ? `${manualEconomics.profit >= 0 ? "+" : ""}${manualEconomics.profit.toFixed(6)} FLOWER` : "—"}</strong></div>
          <div><span>Margem</span><strong>{manualEconomics.complete && manualEconomics.margin !== null ? `${manualEconomics.margin >= 0 ? "+" : ""}${manualEconomics.margin.toFixed(2)}%` : "—"}</strong></div>
          <div><span>Lucro/hora</span><strong>{manualEconomics.complete && manualEconomics.perHour !== null ? `${manualEconomics.perHour >= 0 ? "+" : ""}${manualEconomics.perHour.toFixed(6)} FLOWER/h` : "—"}</strong></div>
        </div>
      </section>

      <div className="database-filters">
        <input
          type="search"
          placeholder="Pesquisar craft ou ingrediente..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select value={building} onChange={(event) => setBuilding(event.target.value)}>
          <option value="all">Todos os prédios</option>
          {buildings.map((buildingName) => (
            <option key={buildingName} value={buildingName}>{buildingName}</option>
          ))}
        </select>
      </div>

      {evaluatedCrafts.length > 0 ? (
        <div className="crafts-grid">
          {evaluatedCrafts.map(({ craft, economics }) => (
            <CraftCard
              key={craft.id}
              craft={craft}
              prices={prices}
              economics={economics}
              quantity={quantity}
              feePct={feePct}
            />
          ))}
        </div>
      ) : (
        <div className="database-empty">
          <h3>Nenhum craft encontrado</h3>
          <p>Tente outro nome, ingrediente ou prédio.</p>
        </div>
      )}
    </div>
  );
}
