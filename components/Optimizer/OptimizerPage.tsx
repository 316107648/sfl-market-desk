"use client";

import { useEffect, useMemo, useState } from "react";
import { crops, type CropData } from "../../lib/gameData";
import { DEFAULT_FARM_PROFILE, loadFarmProfile, loadStoredFarmSnapshot, type FarmProfile, type StoredFarmSnapshot } from "../../lib/farm";
import type { PriceMap } from "../../lib/market";
import { buildFlowerPlan, buildLandPlan, buildXpPlan, parseLandRequirements, type AccountFocus } from "../../lib/services/accountGoalOptimizer";

type OptimizerPageProps = {
  prices: PriceMap;
  onOpenFarm?: () => void;
  onOpenMarket?: (name: string) => void;
};

type CropRanking = {
  crop: CropData;
  marketPrice: number | null;
  grossFlowerPerHour: number | null;
  grossFlowerPerActiveDay: number | null;
  coinProfitPerCycle: number;
  coinProfitPerHour: number;
  theoreticalCycles: number;
};

export default function OptimizerPage({
  prices,
  onOpenFarm,
  onOpenMarket,
}: OptimizerPageProps) {
  const [profile, setProfile] = useState<FarmProfile>(DEFAULT_FARM_PROFILE);
  const [snapshot, setSnapshot] = useState<StoredFarmSnapshot | null>(null);
  const [mode, setMode] = useState<"market" | "coins">("market");
  const [focus, setFocus] = useState<AccountFocus>("flowers");
  const [landNeeds, setLandNeeds] = useState("");

  useEffect(() => {
    setProfile(loadFarmProfile());
    setSnapshot(loadStoredFarmSnapshot());
    const savedFocus = window.localStorage.getItem("sfl-market:account-focus");
    if (savedFocus === "flowers" || savedFocus === "xp" || savedFocus === "land") setFocus(savedFocus);
    setLandNeeds(window.localStorage.getItem("sfl-market:land-requirements") ?? "");
  }, []);

  function chooseFocus(next: AccountFocus) {
    setFocus(next);
    window.localStorage.setItem("sfl-market:account-focus", next);
  }

  function updateLandNeeds(value: string) {
    setLandNeeds(value);
    window.localStorage.setItem("sfl-market:land-requirements", value);
  }

  const ranking = useMemo(() => {
    const eligible = crops.filter((crop) => crop.bumpkinLevel <= profile.bumpkinLevel);

    return eligible
      .map((crop): CropRanking => {
        const marketPrice = prices[crop.name] ?? null;
        const hoursPerCycle = crop.growTimeSeconds / 3600;
        const theoreticalCycles = Math.max(
          0,
          Math.floor(profile.activeHoursPerDay / Math.max(hoursPerCycle, 1 / 60)),
        );
        const grossFlowerPerHour = marketPrice === null
          ? null
          : marketPrice / Math.max(hoursPerCycle, 1 / 60);
        const grossFlowerPerActiveDay = marketPrice === null
          ? null
          : marketPrice * theoreticalCycles * profile.cropPlots;
        const coinProfitPerCycle = Math.max(0, (crop.coinValue ?? 0) - crop.seedPrice);
        const coinProfitPerHour = coinProfitPerCycle / Math.max(hoursPerCycle, 1 / 60);

        return {
          crop,
          marketPrice,
          grossFlowerPerHour,
          grossFlowerPerActiveDay,
          coinProfitPerCycle,
          coinProfitPerHour,
          theoreticalCycles,
        };
      })
      .sort((a, b) => {
        if (mode === "coins") return b.coinProfitPerHour - a.coinProfitPerHour;
        return (b.grossFlowerPerHour ?? -1) - (a.grossFlowerPerHour ?? -1);
      });
  }, [mode, prices, profile]);

  const marketReady = ranking.filter((entry) => entry.marketPrice !== null);
  const flowerPlan = useMemo(() => buildFlowerPlan(profile, snapshot, prices), [profile, snapshot, prices]);
  const xpPlan = useMemo(() => buildXpPlan(profile), [profile]);
  const landPlan = useMemo(() => buildLandPlan(snapshot, parseLandRequirements(landNeeds)), [snapshot, landNeeds]);
  const best = mode === "market" ? marketReady[0] : ranking[0];
  const totalDaily = best?.grossFlowerPerActiveDay ?? null;

  return (
    <div className="optimizer-page">
      <section className="optimizer-hero">
        <div>
          <p className="eyebrow">DAILY OPTIMIZER</p>
          <h2>O que plantar hoje?</h2>
          <p>
            Ranking calculado com seu nível, número de plots, horas ativas e os preços
            disponíveis no mercado. Ele separa FLOWER e Coins para não misturar moedas.
          </p>
        </div>
        <div className="optimizer-profile-summary">
          <span>Perfil usado</span>
          <strong>Nv. {profile.bumpkinLevel} · {profile.cropPlots} plots</strong>
          <small>{profile.activeHoursPerDay}h ativas/dia</small>
          {onOpenFarm && <button type="button" onClick={onOpenFarm}>Editar fazenda</button>}
        </div>
      </section>

      <section className="panel optimizer-ranking-panel">
        <div className="optimizer-section-title">
          <div>
            <p className="eyebrow">OBJETIVO DA CONTA</p>
            <h2>Em que esta conta deve focar?</h2>
          </div>
          <span>{snapshot ? `Farm #${snapshot.farmId} carregada` : "Carregue a Fazenda para recomendações completas"}</span>
        </div>

        <div className="optimizer-mode-switch">
          <button type="button" className={focus === "flowers" ? "active" : ""} onClick={() => chooseFocus("flowers")}>💰 Maximizar FLOWER</button>
          <button type="button" className={focus === "xp" ? "active" : ""} onClick={() => chooseFocus("xp")}>⭐ Evoluir personagem</button>
          <button type="button" className={focus === "land" ? "active" : ""} onClick={() => chooseFocus("land")}>🏝️ Evoluir Land</button>
        </div>

        {focus === "flowers" && (
          <div className="optimizer-goal-result">
            <h3>💰 Estratégia para FLOWER</h3>
            {flowerPlan.bestDaily ? (
              <>
                <p><strong>Melhor plantação calculável agora:</strong> {flowerPlan.bestDaily.name} · {flowerPlan.bestDaily.estimatedFlowerPerDay?.toFixed(6)} FLOWER/dia teóricos.</p>
                <p className="caption">A estimativa diária usa apenas atividades para as quais o projeto já possui tempo e rendimento verificáveis. Frutas, mineração e animais entram no ranking de oportunidade pelo preço atual e pelos dados detectados da sua Farm, sem inventar rendimento faltante.</p>
              </>
            ) : <p>Ainda não há dados suficientes para calcular produção diária em FLOWER.</p>}
            <div className="optimizer-list">
              {flowerPlan.byUnitPrice.slice(0, 8).map((item, index) => (
                <article className="optimizer-row" key={`${item.category}-${item.name}`}>
                  <div className="optimizer-rank">#{index + 1}</div>
                  <div className="optimizer-crop-main"><span className="optimizer-crop-icon">{item.icon}</span><div><strong>{item.name}</strong><small>{item.category}</small></div></div>
                  <div className="optimizer-value"><span>Oferta atual</span><strong>{item.unitPrice.toFixed(6)} FLOWER</strong></div>
                  <div className="optimizer-value"><span>Potencial diário</span><strong>{item.estimatedFlowerPerDay !== undefined ? item.estimatedFlowerPerDay.toFixed(6) : "aguardando rendimento"}</strong></div>
                  <div className="optimizer-value"><span>Conta</span><strong>{item.note}</strong></div>
                </article>
              ))}
            </div>
          </div>
        )}

        {focus === "xp" && (
          <div className="optimizer-goal-result">
            <h3>⭐ Estratégia para evoluir o personagem</h3>
            {xpPlan.best ? (
              <>
                <p><strong>Melhor opção prática:</strong> {xpPlan.best.crop.name} · {xpPlan.best.xpPerCycle.toFixed(2)} XP por colheita.</p>
                <p className="caption">O ranking verifica todas as crops disponíveis, mas não multiplica a pontuação pela quantidade de replantios no dia. Assim, culturas muito rápidas não vencem apenas por exigirem dezenas ou centenas de ciclos. O tempo de crescimento entra somente como desempate.</p>
              </>
            ) : (
              <p>O seletor de foco já está ativo, mas a base atual de crops ainda não possui XP verificado por item. O site não vai inventar esses números; quando a tabela de XP for adicionada, o ranking passa a funcionar automaticamente.</p>
            )}
          </div>
        )}

        {focus === "land" && (
          <div className="optimizer-goal-result">
            <h3>🏝️ Estratégia para evolução da Land</h3>
            <p className="caption">Enquanto a tabela automática de expansões não está mapeada no projeto, informe os recursos da próxima expansão. O site compara com o inventário real da Farm e prioriza o que está faltando.</p>
            <label>
              Recursos necessários
              <textarea value={landNeeds} onChange={(event) => updateLandNeeds(event.target.value)} placeholder="Ex.: Wood=300, Stone=150, Iron=40" rows={3} />
            </label>
            {landPlan.rows.length > 0 ? (
              <div className="optimizer-list">
                {landPlan.rows.map((row, index) => (
                  <article className="optimizer-row" key={row.name}>
                    <div className="optimizer-rank">#{index + 1}</div>
                    <div className="optimizer-crop-main"><span className="optimizer-crop-icon">📦</span><div><strong>{row.name}</strong><small>{row.progressPct.toFixed(0)}% concluído</small></div></div>
                    <div className="optimizer-value"><span>Tem</span><strong>{row.owned.toLocaleString("pt-BR")}</strong></div>
                    <div className="optimizer-value"><span>Precisa</span><strong>{row.required.toLocaleString("pt-BR")}</strong></div>
                    <div className="optimizer-value"><span>Falta</span><strong>{row.missing.toLocaleString("pt-BR")}</strong></div>
                  </article>
                ))}
              </div>
            ) : <p>Informe os recursos da próxima expansão para gerar a prioridade.</p>}
          </div>
        )}
      </section>

      <div className="optimizer-mode-switch">
        <button
          type="button"
          className={mode === "market" ? "active" : ""}
          onClick={() => setMode("market")}
        >
          📈 FLOWER / hora
        </button>
        <button
          type="button"
          className={mode === "coins" ? "active" : ""}
          onClick={() => setMode("coins")}
        >
          🪙 Coins / hora
        </button>
      </div>

      <div className="optimizer-metrics">
        <div className="metric">
          <span>Melhor crop</span>
          <strong>{best?.crop.name ?? "Sem dados"}</strong>
        </div>
        <div className="metric">
          <span>{mode === "market" ? "FLOWER bruto / hora" : "Lucro em Coins / hora"}</span>
          <strong>
            {best
              ? mode === "market"
                ? `${(best.grossFlowerPerHour ?? 0).toFixed(6)} FLOWER`
                : `${best.coinProfitPerHour.toFixed(3)} Coins`
              : "—"}
          </strong>
        </div>
        <div className="metric">
          <span>Ciclos na sua janela</span>
          <strong>{best?.theoreticalCycles ?? 0} por plot</strong>
        </div>
        <div className="metric">
          <span>Receita diária teórica</span>
          <strong>{totalDaily === null ? "—" : `${totalDaily.toFixed(4)} FLOWER`}</strong>
        </div>
      </div>

      {mode === "market" && marketReady.length === 0 && (
        <div className="optimizer-warning">
          Nenhuma crop desbloqueada no seu perfil possui cotação disponível agora.
          O ranking em Coins continua disponível.
        </div>
      )}

      <section className="panel optimizer-ranking-panel">
        <div className="optimizer-section-title">
          <div>
            <p className="eyebrow">RANKING</p>
            <h2>{mode === "market" ? "Eficiência de mercado" : "Eficiência em Coins"}</h2>
          </div>
          <span>{ranking.length} crops compatíveis</span>
        </div>

        <div className="optimizer-list">
          {ranking.slice(0, 12).map((entry, index) => {
            const unavailable = mode === "market" && entry.marketPrice === null;
            return (
              <article className={`optimizer-row ${unavailable ? "disabled" : ""}`} key={entry.crop.id}>
                <div className="optimizer-rank">#{index + 1}</div>
                <div className="optimizer-crop-main">
                  <span className="optimizer-crop-icon">{entry.crop.icon ?? "🌱"}</span>
                  <div>
                    <strong>{entry.crop.name}</strong>
                    <small>Nível {entry.crop.bumpkinLevel} · {formatDuration(entry.crop.growTimeSeconds)}</small>
                  </div>
                </div>
                <div className="optimizer-value">
                  <span>{mode === "market" ? "Preço" : "Lucro/ciclo"}</span>
                  <strong>
                    {mode === "market"
                      ? entry.marketPrice === null
                        ? "Sem cotação"
                        : `${entry.marketPrice.toFixed(6)} FLOWER`
                      : `${entry.coinProfitPerCycle.toFixed(3)} Coins`}
                  </strong>
                </div>
                <div className="optimizer-value">
                  <span>Por hora</span>
                  <strong>
                    {mode === "market"
                      ? entry.grossFlowerPerHour === null
                        ? "—"
                        : entry.grossFlowerPerHour.toFixed(6)
                      : entry.coinProfitPerHour.toFixed(3)}
                  </strong>
                </div>
                <div className="optimizer-value">
                  <span>Na sua rotina</span>
                  <strong>{entry.theoreticalCycles} ciclos/plot</strong>
                </div>
                {entry.marketPrice !== null && onOpenMarket && (
                  <button type="button" className="optimizer-market-link" onClick={() => onOpenMarket?.(entry.crop.name)}>
                    Ver mercado
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <p className="caption">
          FLOWER/h é receita bruta baseada no preço atual e não desconta seed, taxas,
          buffs, energia ou oportunidade de crafting. Coins/h usa apenas valor NPC menos
          preço da seed cadastrado. As duas métricas ficam separadas de propósito.
        </p>
      </section>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = seconds / 3600;
  return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
}
