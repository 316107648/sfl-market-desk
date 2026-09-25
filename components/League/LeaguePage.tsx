"use client";

import { useEffect, useMemo, useState } from "react";
import type { PriceMap } from "../../lib/market";
import {
  INITIAL_DEMO_FLOWER,
  buyAsset,
  calculateNetWorth,
  calculatePortfolioValue,
  calculateRealizedProfit,
  calculateTotalReturnPercent,
  calculateUnrealizedProfit,
  createLeagueAccount,
  getLeagueTier,
  getLevelProgress,
  normalizeLeagueAccount,
  sellAsset,
  type LeagueAccount,
} from "../../lib/league";

const STORAGE_KEY = "smp-market-league-account-v1";

type LeaguePageProps = {
  prices: PriceMap;
};

export default function LeaguePage({ prices }: LeaguePageProps) {
  const [account, setAccount] = useState<LeagueAccount>(() =>
    createLeagueAccount(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(
    Object.keys(prices)[0] ?? "",
  );
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setAccount(normalizeLeagueAccount(JSON.parse(saved)));
      }
    } catch {
      // Mantém uma conta nova se o armazenamento estiver inválido.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    } catch {
      // O simulador continua funcionando mesmo sem persistência local.
    }
  }, [account, hydrated]);

  useEffect(() => {
    if (selectedAsset && prices[selectedAsset] !== undefined) return;
    setSelectedAsset(Object.keys(prices).sort()[0] ?? "");
  }, [prices, selectedAsset]);

  const selectedPrice = prices[selectedAsset] ?? 0;
  const orderTotal = quantity * selectedPrice;
  const selectedHolding = account.holdings.find(
    (holding) => holding.itemName === selectedAsset,
  );

  const portfolioValue = useMemo(
    () => calculatePortfolioValue(account, prices),
    [account, prices],
  );

  const netWorth = useMemo(
    () => calculateNetWorth(account, prices),
    [account, prices],
  );

  const unrealizedProfit = useMemo(
    () => calculateUnrealizedProfit(account, prices),
    [account, prices],
  );

  const realizedProfit = useMemo(
    () => calculateRealizedProfit(account),
    [account],
  );

  const returnPercent = useMemo(
    () => calculateTotalReturnPercent(account, prices),
    [account, prices],
  );

  const tier = getLeagueTier(account.rankingPoints);
  const levelProgress = getLevelProgress(account.xp);
  const tierProgress = tier.nextPoints
    ? Math.min(
        100,
        ((account.rankingPoints - tier.minPoints) /
          (tier.nextPoints - tier.minPoints)) *
          100,
      )
    : 100;

  function handleBuy() {
    try {
      setAccount((current) =>
        buyAsset(current, selectedAsset, quantity, selectedPrice),
      );
      setMessage(`Compra de ${quantity} ${selectedAsset} registrada.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível realizar a compra.",
      );
    }
  }

  function handleSell() {
    try {
      setAccount((current) =>
        sellAsset(current, selectedAsset, quantity, selectedPrice),
      );
      setMessage(`Venda de ${quantity} ${selectedAsset} registrada.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível realizar a venda.",
      );
    }
  }

  function handleReset() {
    const shouldReset = window.confirm(
      "Reiniciar a conta Demo? Saldo, carteira, XP e histórico serão apagados.",
    );

    if (!shouldReset) return;

    setAccount(createLeagueAccount());
    setMessage("Conta Demo reiniciada.");
  }

  return (
    <div className="league-page">
      <section className="league-hero">
        <div>
          <p className="database-label">Sunflower Market League</p>
          <h2>Broker Simulator</h2>
          <p>
            Negocie com Demo FLOWER usando as cotações atuais do mercado.
            Nenhum ativo real é movimentado.
          </p>
        </div>

        <div className="league-rank-card">
          <span className="league-tier-icon">{tier.icon}</span>
          <div>
            <small>Liga atual</small>
            <strong>{tier.name}</strong>
            <span>{account.rankingPoints} RP</span>
          </div>
        </div>
      </section>

      <div className="league-metrics">
        <article className="league-stat league-stat-primary">
          <span>Patrimônio</span>
          <strong>{netWorth.toFixed(4)} Demo FLOWER</strong>
          <small className={returnPercent >= 0 ? "positive" : "negative"}>
            {returnPercent >= 0 ? "+" : ""}
            {returnPercent.toFixed(2)}% desde o início
          </small>
        </article>

        <article className="league-stat">
          <span>Saldo disponível</span>
          <strong>{account.demoFlowerBalance.toFixed(4)}</strong>
          <small>Inicial: {INITIAL_DEMO_FLOWER.toFixed(2)}</small>
        </article>

        <article className="league-stat">
          <span>Carteira</span>
          <strong>{portfolioValue.toFixed(4)}</strong>
          <small>{account.holdings.length} ativos em posição</small>
        </article>

        <article className="league-stat">
          <span>P&L não realizado</span>
          <strong className={unrealizedProfit >= 0 ? "positive" : "negative"}>
            {unrealizedProfit >= 0 ? "+" : ""}
            {unrealizedProfit.toFixed(4)}
          </strong>
          <small>Resultado das posições abertas</small>
        </article>
      </div>

      <div className="league-progress-grid">
        <section className="panel league-progress-card">
          <div className="league-progress-title">
            <div>
              <span>Nível</span>
              <strong>{levelProgress.level}</strong>
            </div>
            <small>
              {levelProgress.progressXp}/{levelProgress.requiredXp} XP
            </small>
          </div>
          <div className="league-progress-track">
            <div
              className="league-progress-fill xp"
              style={{ width: `${levelProgress.percent}%` }}
            />
          </div>
        </section>

        <section className="panel league-progress-card">
          <div className="league-progress-title">
            <div>
              <span>{tier.icon} Liga {tier.name}</span>
              <strong>{account.rankingPoints} RP</strong>
            </div>
            <small>
              {tier.nextPoints
                ? `${tier.nextPoints - account.rankingPoints} RP para a próxima liga`
                : "Liga máxima"}
            </small>
          </div>
          <div className="league-progress-track">
            <div
              className="league-progress-fill rank"
              style={{ width: `${tierProgress}%` }}
            />
          </div>
        </section>
      </div>

      <div className="league-main-grid">
        <section className="panel league-order-panel">
          <div className="league-section-title">
            <div>
              <p className="eyebrow">ORDEM DEMO</p>
              <h2>Operar ativo</h2>
            </div>
            <span className="league-live-badge">● Preço atual</span>
          </div>

          <div className="league-form-grid">
            <label>
              Ativo
              <select
                value={selectedAsset}
                onChange={(event) => {
                  setSelectedAsset(event.target.value);
                  setMessage("");
                }}
              >
                {Object.keys(prices)
                  .sort()
                  .map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Preço atual
              <input value={`${selectedPrice.toFixed(8)} FLOWER`} readOnly />
            </label>

            <label>
              Quantidade
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                value={quantity}
                onChange={(event) =>
                  setQuantity(Math.max(0.0001, Number(event.target.value) || 0.0001))
                }
              />
            </label>

            <div className="league-order-summary">
              <span>Total estimado</span>
              <strong>{orderTotal.toFixed(8)} FLOWER</strong>
              <small>
                Posição atual: {selectedHolding?.quantity.toFixed(4) ?? "0.0000"}
              </small>
            </div>
          </div>

          <div className="league-actions">
            <button className="league-buy" type="button" onClick={handleBuy}>
              Comprar
            </button>
            <button className="league-sell" type="button" onClick={handleSell}>
              Vender
            </button>
          </div>

          {message && <p className="league-message">{message}</p>}
        </section>

        <section className="panel league-pnl-panel">
          <p className="eyebrow">PERFORMANCE</p>
          <h2>Resultado da temporada</h2>

          <div className="league-pnl-list">
            <div>
              <span>P&L realizado</span>
              <strong className={realizedProfit >= 0 ? "positive" : "negative"}>
                {realizedProfit >= 0 ? "+" : ""}
                {realizedProfit.toFixed(6)}
              </strong>
            </div>
            <div>
              <span>P&L aberto</span>
              <strong className={unrealizedProfit >= 0 ? "positive" : "negative"}>
                {unrealizedProfit >= 0 ? "+" : ""}
                {unrealizedProfit.toFixed(6)}
              </strong>
            </div>
            <div>
              <span>Operações</span>
              <strong>{account.trades.length}</strong>
            </div>
            <div>
              <span>Conta criada</span>
              <strong>{new Date(account.createdAt).toLocaleDateString("pt-BR")}</strong>
            </div>
          </div>

          <button className="league-reset" type="button" onClick={handleReset}>
            Reiniciar conta Demo
          </button>
        </section>
      </div>

      <section className="panel league-portfolio-panel">
        <div className="league-section-title">
          <div>
            <p className="eyebrow">PORTFÓLIO</p>
            <h2>Minha carteira</h2>
          </div>
          <span>{account.holdings.length} posições</span>
        </div>

        {account.holdings.length === 0 ? (
          <div className="league-empty">
            <strong>Sua carteira está vazia.</strong>
            <span>Escolha um ativo acima para fazer a primeira compra Demo.</span>
          </div>
        ) : (
          <div className="league-table-wrap">
            <table className="league-table">
              <thead>
                <tr>
                  <th>Ativo</th>
                  <th>Quantidade</th>
                  <th>Preço médio</th>
                  <th>Preço atual</th>
                  <th>Valor</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {account.holdings
                  .map((holding) => {
                    const currentPrice = prices[holding.itemName] ?? 0;
                    const currentValue = holding.quantity * currentPrice;
                    const profit =
                      (currentPrice - holding.averagePrice) * holding.quantity;
                    const profitPercent = holding.averagePrice
                      ? ((currentPrice - holding.averagePrice) /
                          holding.averagePrice) *
                        100
                      : 0;

                    return {
                      holding,
                      currentPrice,
                      currentValue,
                      profit,
                      profitPercent,
                    };
                  })
                  .sort((a, b) => b.currentValue - a.currentValue)
                  .map(({ holding, currentPrice, currentValue, profit, profitPercent }) => (
                    <tr key={holding.itemName}>
                      <td>
                        <button
                          type="button"
                          className="league-asset-link"
                          onClick={() => setSelectedAsset(holding.itemName)}
                        >
                          {holding.itemName}
                        </button>
                      </td>
                      <td>{holding.quantity.toFixed(4)}</td>
                      <td>{holding.averagePrice.toFixed(8)}</td>
                      <td>{currentPrice.toFixed(8)}</td>
                      <td>{currentValue.toFixed(6)}</td>
                      <td className={profit >= 0 ? "positive" : "negative"}>
                        {profit >= 0 ? "+" : ""}
                        {profit.toFixed(6)} ({profitPercent >= 0 ? "+" : ""}
                        {profitPercent.toFixed(2)}%)
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel league-history-panel">
        <div className="league-section-title">
          <div>
            <p className="eyebrow">HISTÓRICO</p>
            <h2>Últimas operações</h2>
          </div>
          <span>{account.trades.length} trades</span>
        </div>

        {account.trades.length === 0 ? (
          <div className="league-empty">
            <strong>Nenhuma operação registrada.</strong>
            <span>Compras e vendas aparecerão aqui automaticamente.</span>
          </div>
        ) : (
          <div className="league-trade-list">
            {account.trades.slice(0, 12).map((trade) => (
              <article className="league-trade" key={trade.id}>
                <div className={`league-trade-type ${trade.type}`}>
                  {trade.type === "buy" ? "COMPRA" : "VENDA"}
                </div>
                <div className="league-trade-main">
                  <strong>{trade.itemName}</strong>
                  <span>
                    {trade.quantity.toFixed(4)} × {trade.unitPrice.toFixed(8)}
                  </span>
                </div>
                <div className="league-trade-total">
                  <strong>{trade.total.toFixed(6)} FLOWER</strong>
                  <span>{new Date(trade.createdAt).toLocaleString("pt-BR")}</span>
                </div>
                <div className="league-trade-profit">
                  {trade.type === "sell" && trade.realizedProfit !== undefined ? (
                    <span
                      className={
                        trade.realizedProfit >= 0 ? "positive" : "negative"
                      }
                    >
                      {trade.realizedProfit >= 0 ? "+" : ""}
                      {trade.realizedProfit.toFixed(6)} P&L
                    </span>
                  ) : (
                    <span className="neutral">posição aberta</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
