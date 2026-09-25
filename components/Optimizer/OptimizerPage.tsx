"use client";

import { useEffect, useMemo, useState } from "react";
import { crops, type CropData } from "../../lib/gameData";
import { DEFAULT_FARM_PROFILE, loadFarmProfile, type FarmProfile } from "../../lib/farm";
import type { PriceMap } from "../../lib/market";

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
  const [mode, setMode] = useState<"market" | "coins">("market");

  useEffect(() => {
    setProfile(loadFarmProfile());
  }, []);

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
