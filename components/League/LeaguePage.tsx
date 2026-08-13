"use client";

import { useMemo, useState } from "react";
import type { PriceMap } from "../../lib/market";
import {
  buyAsset,
  calculateNetWorth,
  calculatePortfolioValue,
  createLeagueAccount,
  sellAsset,
  type LeagueAccount,
} from "../../lib/league";

type LeaguePageProps = {
  prices: PriceMap;
};

export default function LeaguePage({ prices }: LeaguePageProps) {
  const [account, setAccount] = useState<LeagueAccount>(() =>
    createLeagueAccount(),
  );
  const [selectedAsset, setSelectedAsset] = useState(
    Object.keys(prices)[0] ?? "",
  );
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");

  const selectedPrice = prices[selectedAsset] ?? 0;

  const portfolioValue = useMemo(
    () => calculatePortfolioValue(account, prices),
    [account, prices],
  );

  const netWorth = useMemo(
    () => calculateNetWorth(account, prices),
    [account, prices],
  );

  function handleBuy() {
    try {
      setAccount((current) =>
        buyAsset(
          current,
          selectedAsset,
          quantity,
          selectedPrice,
        ),
      );
      setMessage("Compra simulada realizada.");
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
        sellAsset(
          current,
          selectedAsset,
          quantity,
          selectedPrice,
        ),
      );
      setMessage("Venda simulada realizada.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível realizar a venda.",
      );
    }
  }

  return (
    <div className="league-page">
      <div className="database-header">
        <div>
          <p className="database-label">Sunflower Market League</p>
          <h2>Simulador de Mercado</h2>
          <p>
            Compre e venda ativos fictícios usando os preços reais
            do mercado.
          </p>
        </div>

        <div className="database-total">
          <strong>{netWorth.toFixed(4)}</strong>
          <span>patrimônio Demo FLOWER</span>
        </div>
      </div>

      <div className="metrics">
        <div className="metric">
          <span>Saldo disponível</span>
          <strong>{account.demoFlowerBalance.toFixed(4)}</strong>
        </div>

        <div className="metric">
          <span>Valor da carteira</span>
          <strong>{portfolioValue.toFixed(4)}</strong>
        </div>

        <div className="metric">
          <span>XP</span>
          <strong>{account.xp}</strong>
        </div>

        <div className="metric">
          <span>Pontos de ranking</span>
          <strong>{account.rankingPoints}</strong>
        </div>
      </div>

      <div className="two-col">
        <section className="panel form-panel">
          <h2>Operar ativo</h2>

          <label>
            Ativo
            <select
              value={selectedAsset}
              onChange={(event) =>
                setSelectedAsset(event.target.value)
              }
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
            <input
              value={`${selectedPrice.toFixed(8)} FLOWER`}
              readOnly
            />
          </label>

          <label>
            Quantidade
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  Math.max(1, Number(event.target.value) || 1),
                )
              }
            />
          </label>

          <div className="league-order-total">
            Total da operação:
            <strong>
              {(quantity * selectedPrice).toFixed(8)} FLOWER
            </strong>
          </div>

          <div className="league-actions">
            <button type="button" onClick={handleBuy}>
              Comprar
            </button>

            <button type="button" onClick={handleSell}>
              Vender
            </button>
          </div>

          {message && (
            <p className="caption">{message}</p>
          )}
        </section>

        <section className="panel">
          <h2>Minha carteira</h2>

          {account.holdings.length === 0 ? (
            <div className="database-empty">
              <p>Nenhum ativo comprado ainda.</p>
            </div>
          ) : (
            <div className="league-holdings">
              {account.holdings.map((holding) => {
                const currentPrice =
                  prices[holding.itemName] ?? 0;
                const currentValue =
                  holding.quantity * currentPrice;
                const profit =
                  currentValue -
                  holding.quantity * holding.averagePrice;

                return (
                  <div
                    className="league-holding"
                    key={holding.itemName}
                  >
                    <div>
                      <strong>{holding.itemName}</strong>
                      <span>
                        {holding.quantity} unidades
                      </span>
                    </div>

                    <div>
                      <strong>
                        {currentValue.toFixed(6)} FLOWER
                      </strong>
                      <span
                        className={
                          profit > 0
                            ? "positive"
                            : profit < 0
                              ? "negative"
                              : "neutral"
                        }
                      >
                        {profit >= 0 ? "+" : ""}
                        {profit.toFixed(6)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}