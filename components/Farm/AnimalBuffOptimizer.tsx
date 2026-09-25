"use client";

import { useEffect, useMemo, useState } from "react";
import type { PriceMap } from "../../lib/market";
import type { FarmLiveAnimal } from "../../lib/farm/liveData";
import { loadCloudState, saveCloudState } from "../../lib/cloud/client";

type Props = { animals: FarmLiveAnimal[]; prices: PriceMap; farmId?: string };
type BuffType = "none" | "yield5" | "feed20";
type RowSettings = {
  feedings: string;
  feedCost: string;
  yieldPerFeed: string;
  productPrice: string;
  saleFee: string;
  buffType: BuffType;
  buffCost: string;
  buffRounds: string;
};

type AnimalGroup = {
  key: string;
  kind: string;
  level?: number;
  count: number;
  product: string;
  apiBuffs: string[];
};

const STORAGE_KEY = "sfl-animal-profit-planner-v1";
const num = (value: string) => Math.max(0, Number(String(value).replace(",", ".")) || 0);

function productFor(kind: string) {
  const k = kind.toLowerCase();
  if (k.includes("cow")) return "Milk";
  if (k.includes("sheep")) return "Wool";
  if (k.includes("chicken")) return "Egg";
  return "Produto";
}

function animalIcon(kind: string) {
  const k = kind.toLowerCase();
  if (k.includes("cow")) return "🐄";
  if (k.includes("sheep")) return "🐑";
  if (k.includes("chicken")) return "🐔";
  return "🐾";
}

function defaultSettings(group: AnimalGroup, prices: PriceMap): RowSettings {
  const price = prices[group.product];
  return {
    feedings: "1",
    feedCost: "0",
    yieldPerFeed: "1",
    productPrice: Number.isFinite(price) ? String(price) : "0",
    saleFee: "7.5",
    buffType: "none",
    buffCost: "0",
    buffRounds: "3",
  };
}

export default function AnimalBuffOptimizer({ animals, prices, farmId }: Props) {
  const groups = useMemo<AnimalGroup[]>(() => {
    const map = new Map<string, AnimalGroup>();
    for (const animal of animals) {
      const level = animal.level;
      const key = `${animal.kind}::${level ?? "unknown"}`;
      const current = map.get(key) ?? {
        key,
        kind: animal.kind,
        level,
        count: 0,
        product: productFor(animal.kind),
        apiBuffs: [],
      };
      current.count += 1;
      for (const field of animal.buffFields ?? []) {
        if (!current.apiBuffs.includes(field)) current.apiBuffs.push(field);
      }
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => {
      const kind = a.kind.localeCompare(b.kind);
      if (kind !== 0) return kind;
      return (a.level ?? 999) - (b.level ?? 999);
    });
  }, [animals]);

  const [settings, setSettings] = useState<Record<string, RowSettings>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings(JSON.parse(raw));
    } catch {}

    if (farmId) {
      void loadCloudState<Record<string, RowSettings>>(farmId, "animal_profit_settings").then((cloud) => {
        if (active && cloud.ok && cloud.data && typeof cloud.data === "object") setSettings(cloud.data);
      });
    }
    return () => { active = false; };
  }, [farmId]);

  useEffect(() => {
    if (!Object.keys(settings).length) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
    if (!farmId) return;
    const timer = window.setTimeout(() => {
      void saveCloudState(farmId, "animal_profit_settings", settings);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [settings, farmId]);

  useEffect(() => {
    if (!groups.length) return;
    setSettings((current) => {
      const next = { ...current };
      let changed = false;
      for (const group of groups) {
        if (!next[group.key]) {
          next[group.key] = defaultSettings(group, prices);
          changed = true;
        } else if (num(next[group.key].productPrice) === 0 && Number.isFinite(prices[group.product])) {
          next[group.key] = { ...next[group.key], productPrice: String(prices[group.product]) };
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [groups, prices]);

  function patch(key: string, partial: Partial<RowSettings>) {
    setSettings((current) => ({
      ...current,
      [key]: { ...(current[key] ?? defaultSettings(groups.find((g) => g.key === key)!, prices)), ...partial },
    }));
  }

  const calculations = useMemo(() => groups.map((group) => {
    const s = settings[group.key] ?? defaultSettings(group, prices);
    const animalsCount = group.count;
    const feedsEach = num(s.feedings);
    const totalFeeds = animalsCount * feedsEach;
    const baseFeedCost = num(s.feedCost);
    const yieldEach = num(s.yieldPerFeed);
    const productPrice = num(s.productPrice);
    const saleFee = Math.min(100, num(s.saleFee));
    const buffRounds = Math.max(1, num(s.buffRounds));
    const buffCost = num(s.buffCost);

    const yieldMultiplier = s.buffType === "yield5" ? 1.05 : 1;
    const feedMultiplier = s.buffType === "feed20" ? 0.8 : 1;
    const grossOutput = totalFeeds * yieldEach * yieldMultiplier;
    const grossRevenue = grossOutput * productPrice;
    const netRevenue = grossRevenue * (1 - saleFee / 100);
    const feedSpend = totalFeeds * baseFeedCost * feedMultiplier;
    const buffUsesPerAnimal = s.buffType === "none" || feedsEach <= 0 ? 0 : Math.ceil(feedsEach / buffRounds);
    const totalBuffUses = buffUsesPerAnimal * animalsCount;
    const buffSpend = totalBuffUses * buffCost;
    const totalCost = feedSpend + buffSpend;
    const profit = netRevenue - totalCost;

    const netPerProduct = productPrice * (1 - saleFee / 100);
    const buffCostPerFeed = totalFeeds > 0 ? buffSpend / totalFeeds : 0;
    const maxBaseFeedCost = totalFeeds > 0
      ? Math.max(0, (netRevenue - buffSpend) / (totalFeeds * feedMultiplier))
      : 0;
    const minYield = totalFeeds > 0 && netPerProduct > 0
      ? totalCost / (totalFeeds * netPerProduct * yieldMultiplier)
      : 0;

    return { group, s, totalFeeds, grossOutput, netRevenue, feedSpend, buffSpend, totalCost, profit, maxBaseFeedCost, minYield, buffCostPerFeed };
  }), [groups, settings, prices]);

  const totals = useMemo(() => calculations.reduce((acc, row) => {
    acc.revenue += row.netRevenue;
    acc.cost += row.totalCost;
    acc.profit += row.profit;
    acc.feeds += row.totalFeeds;
    return acc;
  }, { revenue: 0, cost: 0, profit: 0, feeds: 0 }), [calculations]);

  return (
    <section className="animal-plan">
      <div className="animal-plan-head">
        <div>
          <p className="eyebrow">PLANO DE ALIMENTAÇÃO</p>
          <h3>🐾 Quanto custa manter seus animais?</h3>
          <p>O site já conta os animais por nível. Até automatizarmos a alimentação, informe quantas vezes cada animal será alimentado e o custo por alimentação.</p>
        </div>
        <div className={`animal-plan-summary ${totals.profit >= 0 ? "good" : "bad"}`}>
          <span>Resultado estimado</span>
          <strong>{totals.profit >= 0 ? "+" : ""}{totals.profit.toFixed(6)} FLOWER</strong>
          <small>{totals.feeds} alimentações · receita líquida {totals.revenue.toFixed(6)}</small>
        </div>
      </div>

      {groups.length === 0 ? <p className="muted">Nenhum animal com nível foi detectado.</p> : (
        <div className="animal-level-grid">
          {calculations.map(({ group, s, totalFeeds, grossOutput, netRevenue, totalCost, profit, maxBaseFeedCost, minYield, feedSpend, buffSpend }) => {
            const expanded = openKey === group.key;
            return (
              <article className={`animal-level-card ${profit >= 0 ? "good" : "bad"}`} key={group.key}>
                <button className="animal-level-main" type="button" onClick={() => setOpenKey(expanded ? null : group.key)}>
                  <div className="animal-level-id">
                    <span className="animal-level-icon">{animalIcon(group.kind)}</span>
                    <div><strong>{group.kind}</strong><small>{group.level !== undefined ? `Nível ${group.level}` : "Nível não identificado"}</small></div>
                  </div>
                  <div className="animal-level-count"><strong>{group.count}</strong><small>animais</small></div>
                  <div className="animal-level-profit"><small>Resultado</small><strong>{profit >= 0 ? "+" : ""}{profit.toFixed(5)}</strong><span>{profit >= 0 ? "✅ lucro" : "❌ prejuízo"}</span></div>
                  <span className="animal-level-chevron">{expanded ? "▲" : "▼"}</span>
                </button>

                <div className="animal-level-quick">
                  <label>Alimentações / animal<input value={s.feedings} onChange={(e) => patch(group.key, { feedings: e.target.value })} inputMode="numeric" /></label>
                  <label>Custo / alimentação<input value={s.feedCost} onChange={(e) => patch(group.key, { feedCost: e.target.value })} inputMode="decimal" /></label>
                  <label>{group.product} / alimentação<input value={s.yieldPerFeed} onChange={(e) => patch(group.key, { yieldPerFeed: e.target.value })} inputMode="decimal" /></label>
                  <label>Buff<select value={s.buffType} onChange={(e) => patch(group.key, { buffType: e.target.value as BuffType })}><option value="none">Sem buff</option><option value="yield5">+5% rendimento</option><option value="feed20">-20% comida</option></select></label>
                </div>

                <div className="animal-level-break">
                  <span>Para ainda valer a pena:</span>
                  <strong>alimentação até {maxBaseFeedCost.toFixed(6)} FLOWER</strong>
                  <small>ou pelo menos {minYield.toFixed(3)} {group.product} por alimentação</small>
                </div>

                {expanded && (
                  <div className="animal-level-details">
                    <div className="animal-level-fields">
                      <label>Preço {group.product} (FLOWER)<input value={s.productPrice} onChange={(e) => patch(group.key, { productPrice: e.target.value })} inputMode="decimal" /></label>
                      <label>Taxa de venda (%)<input value={s.saleFee} onChange={(e) => patch(group.key, { saleFee: e.target.value })} inputMode="decimal" /></label>
                      <label>Custo do buff (FLOWER)<input value={s.buffCost} onChange={(e) => patch(group.key, { buffCost: e.target.value })} inputMode="decimal" disabled={s.buffType === "none"} /></label>
                      <label>Duração do buff (rodadas)<input value={s.buffRounds} onChange={(e) => patch(group.key, { buffRounds: e.target.value })} inputMode="numeric" disabled={s.buffType === "none"} /></label>
                    </div>
                    <div className="animal-level-math">
                      <span>Total de alimentações <b>{totalFeeds}</b></span>
                      <span>Produção estimada <b>{grossOutput.toFixed(3)} {group.product}</b></span>
                      <span>Custo da comida <b>-{feedSpend.toFixed(6)}</b></span>
                      <span>Custo dos buffs <b>-{buffSpend.toFixed(6)}</b></span>
                      <span>Custo total <b>-{totalCost.toFixed(6)}</b></span>
                      <span>Venda líquida <b>+{netRevenue.toFixed(6)}</b></span>
                    </div>
                    {group.apiBuffs.length ? <p className="animal-api-note">API detectou: {group.apiBuffs.join(" · ")}</p> : <p className="animal-api-note">Nenhum campo de buff temporário foi identificado automaticamente neste grupo ainda.</p>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      <p className="muted animal-plan-note">Os valores continuam com cópia local e, quando o PostgreSQL estiver configurado no Render, também são sincronizados na nuvem para esta Farm ID.</p>
    </section>
  );
}
