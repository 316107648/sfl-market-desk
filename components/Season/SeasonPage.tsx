"use client";

import { useEffect, useMemo, useState } from "react";
import type { PriceMap } from "../../lib/market";
import { loadFarmProfile } from "../../lib/farm";
import { loadCloudState, saveCloudState } from "../../lib/cloud/client";

type Strategy = "season" | "expand_land" | "bumpkin" | "farm_token" | "balanced";
type Ambition = "casual" | "efficient" | "competitive" | "top";
type Currency = "FLOWER" | "COINS";
type ExpenseCategory =
  | "season"
  | "market"
  | "craft"
  | "delivery"
  | "expansion"
  | "bumpkin"
  | "animals"
  | "other";

type SeasonExpense = {
  id: string;
  at: string;
  category: ExpenseCategory;
  currency: Currency;
  amount: number;
  note: string;
};

type SeasonState = {
  name: string;
  startDate: string;
  endDate: string;
  strategy: Strategy;
  ambition: Ambition;
  flowerBudget: number;
  dailyFlowerLimit: number;
  target: string;
  expenses: SeasonExpense[];
};

type SeasonPageProps = {
  prices: PriceMap;
};

const STORAGE_KEY = "smp-season-planner-v1";

const defaultState: SeasonState = {
  name: "Temporada atual",
  startDate: "2026-08-09",
  endDate: "",
  strategy: "balanced",
  ambition: "efficient",
  flowerBudget: 100,
  dailyFlowerLimit: 5,
  target: "Participar sem comprometer a evolução da fazenda.",
  expenses: [],
};

const strategyLabels: Record<Strategy, string> = {
  season: "🏆 Priorizar temporada",
  expand_land: "🗺️ Expandir a Land",
  bumpkin: "🧑 Evoluir Bumpkin",
  farm_token: "🌻 Farmar FLOWER / token",
  balanced: "⚖️ Estratégia equilibrada",
};

const ambitionLabels: Record<Ambition, string> = {
  casual: "Participação casual",
  efficient: "Melhor custo-benefício",
  competitive: "Competir por boas recompensas",
  top: "Buscar ranking / máxima progressão",
};

const categoryLabels: Record<ExpenseCategory, string> = {
  season: "Temporada / evento",
  market: "Mercado",
  craft: "Craft",
  delivery: "Entregas",
  expansion: "Expansão",
  bumpkin: "Bumpkin",
  animals: "Animais",
  other: "Outros",
};

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(value);
}

export default function SeasonPage({ prices }: SeasonPageProps) {
  const [state, setState] = useState<SeasonState>(defaultState);
  const [ready, setReady] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>("season");
  const [currency, setCurrency] = useState<Currency>("FLOWER");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let active = true;
    const localProfile = loadFarmProfile();
    const profileId = localProfile.landId?.trim();

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SeasonState>;
        setState({ ...defaultState, ...parsed, expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [] });
      }
    } catch {
      // Mantém os valores padrão se o armazenamento estiver indisponível.
    }

    if (profileId) {
      void loadCloudState<SeasonState>(profileId, "season_planner").then((cloud) => {
        if (active && cloud.ok && cloud.data) {
          setState({ ...defaultState, ...cloud.data, expenses: Array.isArray(cloud.data.expenses) ? cloud.data.expenses : [] });
        }
        if (active) setReady(true);
      });
    } else {
      setReady(true);
    }

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // O planner continua funcionando mesmo sem persistência local.
    }

    const profileId = loadFarmProfile().landId?.trim();
    if (!profileId) return;
    const timer = window.setTimeout(() => {
      void saveCloudState(profileId, "season_planner", state);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [state, ready]);

  const flowerSpent = useMemo(
    () => state.expenses.filter((entry) => entry.currency === "FLOWER").reduce((sum, entry) => sum + entry.amount, 0),
    [state.expenses],
  );
  const coinsSpent = useMemo(
    () => state.expenses.filter((entry) => entry.currency === "COINS").reduce((sum, entry) => sum + entry.amount, 0),
    [state.expenses],
  );
  const remainingBudget = Math.max(0, state.flowerBudget - flowerSpent);
  const budgetUsage = state.flowerBudget > 0 ? (flowerSpent / state.flowerBudget) * 100 : 0;

  const todayFlowerSpent = useMemo(() => {
    const today = todayLocal();
    return state.expenses
      .filter((entry) => entry.currency === "FLOWER" && entry.at.slice(0, 10) === today)
      .reduce((sum, entry) => sum + entry.amount, 0);
  }, [state.expenses]);

  const recommendations = useMemo(() => {
    const tips: string[] = [];
    const dailyLeft = Math.max(0, state.dailyFlowerLimit - todayFlowerSpent);

    if (budgetUsage >= 100) {
      tips.push("Seu orçamento de FLOWER para a temporada foi atingido. Priorize ações que usem inventário já existente antes de novos gastos.");
    } else if (budgetUsage >= 80) {
      tips.push("Você já consumiu mais de 80% do orçamento. Reavalie compras de baixa prioridade antes de continuar a temporada.");
    } else {
      tips.push(`Restam aproximadamente ${formatAmount(remainingBudget)} FLOWER dentro do orçamento definido.`);
    }

    if (state.dailyFlowerLimit > 0) {
      tips.push(`Limite diário: você ainda tem ${formatAmount(dailyLeft)} FLOWER de margem hoje.`);
    }

    switch (state.strategy) {
      case "season":
        tips.push("Priorize tarefas e crafts que avancem diretamente a temporada; evite imobilizar FLOWER em expansão que não gere progresso sazonal imediato.");
        break;
      case "expand_land":
        tips.push("Antes de gastar na temporada, compare o custo com materiais necessários para a próxima expansão e preserve uma reserva para a Land.");
        break;
      case "bumpkin":
        tips.push("Dê preferência a ações que também gerem XP/skills do Bumpkin. Gastos sazonais sem benefício permanente devem ter um teto menor.");
        break;
      case "farm_token":
        tips.push("Evite compras puramente cosméticas ou de ranking. Priorize produção vendável, ciclos rentáveis e itens com boa liquidez em FLOWER.");
        break;
      default:
        tips.push("Divida o orçamento entre progresso sazonal e evolução permanente; aumente os gastos apenas quando a recompensa marginal justificar.");
    }

    if (state.ambition === "casual") tips.push("Ambição casual: pare quando o próximo marco exigir gasto desproporcional ao benefício recebido.");
    if (state.ambition === "efficient") tips.push("Custo-benefício: avance até o ponto em que o custo incremental por recompensa começar a acelerar demais.");
    if (state.ambition === "competitive") tips.push("Competitivo: acompanhe gasto por dia e mantenha reserva para a reta final, quando requisitos e preços podem aumentar.");
    if (state.ambition === "top") tips.push("Ranking: trate a temporada como orçamento fechado e registre cada compra; não use patrimônio essencial da fazenda sem uma meta explícita de retorno.");

    const liquidItems = Object.entries(prices).filter(([, price]) => Number.isFinite(price) && price > 0).length;
    if (liquidItems > 0) tips.push(`O planner está conectado ao mesmo mercado do site (${liquidItems} ativos com preço), pronto para cruzar custos reais em uma próxima etapa.`);

    return tips;
  }, [budgetUsage, prices, remainingBudget, state.ambition, state.dailyFlowerLimit, state.strategy, todayFlowerSpent]);

  function update<K extends keyof SeasonState>(key: K, value: SeasonState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function addExpense() {
    const parsed = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const entry: SeasonExpense = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      category,
      currency,
      amount: parsed,
      note: note.trim(),
    };
    setState((current) => ({ ...current, expenses: [entry, ...current.expenses] }));
    setAmount("");
    setNote("");
  }

  function removeExpense(id: string) {
    setState((current) => ({ ...current, expenses: current.expenses.filter((entry) => entry.id !== id) }));
  }

  return (
    <div className="season-page">
      <section className="season-hero panel">
        <div>
          <p className="eyebrow">ESTRATÉGIA DA CONTA</p>
          <h2>{state.name}</h2>
          <p>Registre os gastos desta temporada e defina a intenção da conta. Com o PostgreSQL do Render configurado, este histórico também fica salvo na nuvem por Farm ID.</p>
        </div>
        <div className="season-budget-ring">
          <strong>{Math.min(999, budgetUsage).toFixed(0)}%</strong>
          <span>do orçamento</span>
        </div>
      </section>

      <section className="season-kpis">
        <div className="panel"><small>Gasto em FLOWER</small><strong>{formatAmount(flowerSpent)}</strong><span>de {formatAmount(state.flowerBudget)}</span></div>
        <div className="panel"><small>Saldo do orçamento</small><strong>{formatAmount(remainingBudget)}</strong><span>FLOWER</span></div>
        <div className="panel"><small>Coins registrados</small><strong>{formatAmount(coinsSpent)}</strong><span>COINS</span></div>
        <div className="panel"><small>Movimentos</small><strong>{state.expenses.length}</strong><span>nesta temporada</span></div>
      </section>

      <section className="season-grid">
        <div className="panel season-settings">
          <h3>🎯 Plano da temporada</h3>
          <label>Nome da temporada<input value={state.name} onChange={(event) => update("name", event.target.value)} /></label>
          <div className="season-two-col">
            <label>Início<input type="date" value={state.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
            <label>Fim<input type="date" value={state.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
          </div>
          <label>Estratégia principal<select value={state.strategy} onChange={(event) => update("strategy", event.target.value as Strategy)}>{Object.entries(strategyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Ambição<select value={state.ambition} onChange={(event) => update("ambition", event.target.value as Ambition)}>{Object.entries(ambitionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="season-two-col">
            <label>Orçamento FLOWER<input type="number" min="0" step="0.1" value={state.flowerBudget} onChange={(event) => update("flowerBudget", Number(event.target.value) || 0)} /></label>
            <label>Limite diário<input type="number" min="0" step="0.1" value={state.dailyFlowerLimit} onChange={(event) => update("dailyFlowerLimit", Number(event.target.value) || 0)} /></label>
          </div>
          <label>Objetivo<textarea value={state.target} onChange={(event) => update("target", event.target.value)} rows={3} /></label>
        </div>

        <div className="panel season-advisor">
          <h3>✦ Recomendações para sua estratégia</h3>
          <div className="season-strategy-badge">{strategyLabels[state.strategy]} · {ambitionLabels[state.ambition]}</div>
          <div className="season-recommendations">{recommendations.map((tip, index) => <div key={`${index}-${tip}`}><span>{index + 1}</span><p>{tip}</p></div>)}</div>
          <p className="season-note">Estas recomendações ainda são regras locais do planner. Quando ligarmos o Data Vault à Farm API, elas poderão considerar inventário, trades, progresso, expansão, Bumpkin e eventos reais da conta.</p>
        </div>
      </section>

      <section className="season-grid season-ledger-grid">
        <div className="panel season-entry-form">
          <h3>➕ Registrar gasto</h3>
          <div className="season-two-col">
            <label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Moeda<select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}><option value="FLOWER">FLOWER</option><option value="COINS">COINS</option></select></label>
          </div>
          <label>Valor<input value={amount} inputMode="decimal" placeholder="Ex.: 3,25" onChange={(event) => setAmount(event.target.value)} /></label>
          <label>Descrição<input value={note} placeholder="Ex.: materiais para missão da temporada" onChange={(event) => setNote(event.target.value)} /></label>
          <button onClick={addExpense}>Salvar no histórico</button>
          <small>Por enquanto o histórico fica salvo neste navegador. A próxima camada será o Data Vault no backend para manter dados entre dispositivos e sincronizar mudanças da Farm API.</small>
        </div>

        <div className="panel season-ledger">
          <div className="season-ledger-title"><h3>🧾 Histórico da temporada</h3><span>{state.expenses.length} registros</span></div>
          {state.expenses.length === 0 ? (
            <p className="season-empty">Nenhum gasto registrado ainda.</p>
          ) : (
            <div className="season-ledger-list">
              {state.expenses.map((entry) => (
                <div className="season-ledger-row" key={entry.id}>
                  <div><strong>{categoryLabels[entry.category]}</strong><small>{new Date(entry.at).toLocaleString("pt-BR")} {entry.note ? `· ${entry.note}` : ""}</small></div>
                  <div className="season-ledger-value"><strong>{formatAmount(entry.amount)} {entry.currency}</strong><button onClick={() => removeExpense(entry.id)} title="Excluir registro">×</button></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
