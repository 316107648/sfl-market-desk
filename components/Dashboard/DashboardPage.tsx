type DashboardPageProps = {
  onNavigate: (tab: string) => void;
};

export default function DashboardPage({
  onNavigate,
}: DashboardPageProps) {
  return (
    <>
      <div className="metrics dashboard-metrics">
        <div className="metric">
          <span>Valor estimado da fazenda</span>
          <strong>Conecte sua fazenda</strong>
        </div>

        <div className="metric">
          <span>Melhor atividade hoje</span>
          <strong>Em breve</strong>
        </div>

        <div className="metric">
          <span>Melhor plantação</span>
          <strong>Em breve</strong>
        </div>

        <div className="metric">
          <span>Próxima expansão</span>
          <strong>Dados pendentes</strong>
        </div>
      </div>

      <div className="module-grid">
        <button
          className="module-card"
          onClick={() => onNavigate("farm")}
        >
          <span>🌻</span>
          <strong>Minha Fazenda</strong>
          <small>Inventário, NFTs, skills e buffs.</small>
        </button>

        <button
          className="module-card"
          onClick={() => onNavigate("optimizer")}
        >
          <span>⚡</span>
          <strong>Daily Optimizer</strong>
          <small>O que produzir, plantar e minerar hoje.</small>
        </button>

        <button
          className="module-card"
          onClick={() => onNavigate("expansion")}
        >
          <span>🗺️</span>
          <strong>Expansion Planner</strong>
          <small>Custos, recursos faltantes e estratégia.</small>
        </button>

        <button
          className="module-card"
          onClick={() => onNavigate("deliveries")}
        >
          <span>📦</span>
          <strong>Entregas</strong>
          <small>Priorize missões por custo e recompensa.</small>
        </button>

        <button
          className="module-card"
          onClick={() => onNavigate("market")}
        >
          <span>📈</span>
          <strong>Mercado</strong>
          <small>Preços, histórico e sinais estatísticos.</small>
        </button>

        <button
          className="module-card"
          onClick={() => onNavigate("advisor")}
        >
          <span>✦</span>
          <strong>AI Advisor</strong>
          <small>Recomendações personalizadas para sua fazenda.</small>
        </button>
      </div>
    </>
  );
}