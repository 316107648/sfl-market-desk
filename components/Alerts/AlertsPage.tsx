"use client";

import { useEffect, useMemo, useState } from "react";
import type { PriceMap } from "../../lib/market";
import {
  loadAlertRules,
  saveAlertRules,
  type PriceAlertDirection,
  type PriceAlertRule,
} from "../../lib/alerts";

type AlertsPageProps = {
  prices: PriceMap;
};

type TelegramStatus = "loading" | "ready" | "missing" | "error";

export default function AlertsPage({ prices }: AlertsPageProps) {
  const assets = useMemo(() => Object.keys(prices).sort(), [prices]);
  const [rules, setRules] = useState<PriceAlertRule[]>([]);
  const [asset, setAsset] = useState(assets[0] ?? "");
  const [direction, setDirection] =
    useState<PriceAlertDirection>("below");
  const [target, setTarget] = useState("");
  const [telegramStatus, setTelegramStatus] =
    useState<TelegramStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setRules(loadAlertRules());
  }, []);

  useEffect(() => {
    if (!asset && assets[0]) setAsset(assets[0]);
  }, [asset, assets]);

  useEffect(() => {
    void fetch("/api/telegram", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => {
        setTelegramStatus(data.configured ? "ready" : "missing");
      })
      .catch(() => setTelegramStatus("error"));
  }, []);

  function persist(next: PriceAlertRule[]) {
    setRules(next);
    saveAlertRules(next);
  }

  function addRule() {
    const numericTarget = Number(target);

    if (!asset || !Number.isFinite(numericTarget) || numericTarget <= 0) {
      setMessage("Escolha um ativo e informe um preço-alvo válido.");
      return;
    }

    const next: PriceAlertRule = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      asset,
      direction,
      target: numericTarget,
      enabled: true,
      createdAt: Date.now(),
    };

    persist([next, ...rules]);
    setTarget("");
    setMessage("Alerta criado.");
  }

  async function sendTest() {
    setMessage("Enviando mensagem de teste...");

    try {
      const response = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "test" }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      setMessage(
        response.ok && data.ok
          ? "Mensagem enviada. Confira o Telegram."
          : data.error || "Não foi possível enviar a mensagem.",
      );
    } catch {
      setMessage("Não foi possível conectar ao serviço de Telegram.");
    }
  }

  return (
    <div className="alerts-page">
      <div className="database-header">
        <div>
          <p className="database-label">Sunflower Market Pro</p>
          <h2>Alertas no Telegram</h2>
          <p>
            Receba um aviso quando um ativo cruzar o preço configurado.
          </p>
        </div>

        <div className="database-total">
          <strong>{rules.filter((rule) => rule.enabled).length}</strong>
          <span>alertas ativos</span>
        </div>
      </div>

      <div className="alert-status panel">
        <div>
          <span className="eyebrow">CONEXÃO TELEGRAM</span>
          <h3>
            {telegramStatus === "ready"
              ? "✅ Bot configurado"
              : telegramStatus === "missing"
                ? "⚠️ Configuração pendente"
                : telegramStatus === "error"
                  ? "❌ Falha ao verificar"
                  : "Verificando..."}
          </h3>
          <p className="caption">
            O token do bot e o Chat ID ficam somente no ambiente do servidor.
            Eles nunca são enviados ao navegador.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void sendTest()}
          disabled={telegramStatus !== "ready"}
        >
          Enviar teste
        </button>
      </div>

      <div className="two-col alert-layout">
        <section className="panel form-panel">
          <h2>Novo alerta</h2>

          <label>
            Ativo
            <select value={asset} onChange={(event) => setAsset(event.target.value)}>
              {assets.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Condição
            <select
              value={direction}
              onChange={(event) =>
                setDirection(event.target.value as PriceAlertDirection)
              }
            >
              <option value="below">Preço cair para / abaixo de</option>
              <option value="above">Preço subir para / acima de</option>
            </select>
          </label>

          <label>
            Preço-alvo (FLOWER)
            <input
              inputMode="decimal"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder={asset ? String(prices[asset] ?? "") : "0.00"}
            />
          </label>

          {asset && (
            <div className="league-order-total">
              Preço atual
              <strong>{(prices[asset] ?? 0).toFixed(8)} FLOWER</strong>
            </div>
          )}

          <button type="button" onClick={addRule}>
            Criar alerta
          </button>

          {message && <p className="caption">{message}</p>}
        </section>

        <section className="panel">
          <h2>Meus alertas</h2>

          {rules.length === 0 ? (
            <div className="database-empty">
              <p>Nenhum alerta criado ainda.</p>
            </div>
          ) : (
            <div className="alert-rule-list">
              {rules.map((rule) => (
                <div className="alert-rule" key={rule.id}>
                  <div>
                    <strong>{rule.asset}</strong>
                    <span>
                      {rule.direction === "above" ? "≥" : "≤"}{" "}
                      {rule.target.toFixed(8)} FLOWER
                    </span>
                  </div>

                  <div className="alert-rule-actions">
                    <button
                      type="button"
                      className={rule.enabled ? "active" : ""}
                      onClick={() =>
                        persist(
                          rules.map((item) =>
                            item.id === rule.id
                              ? { ...item, enabled: !item.enabled }
                              : item,
                          ),
                        )
                      }
                    >
                      {rule.enabled ? "Ativo" : "Pausado"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        persist(rules.filter((item) => item.id !== rule.id))
                      }
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="analysis-callout hold alert-note">
        <strong>Como funciona nesta versão</strong>
        <p>
          O alerta é verificado sempre que o Sunflower Market Pro recebe uma
          atualização de preços. Para avisos 24/7 mesmo com o site fechado,
          vamos mover as regras para o backend quando implementarmos contas de
          usuário e banco de dados.
        </p>
      </div>
    </div>
  );
}
