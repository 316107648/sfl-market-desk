import { items as gameItems } from "../../lib/gameData";

export default function DatabasePage() {
  return (
    <div className="database-page">
      <div className="database-header">
        <div>
          <p className="database-label">Sunflower Land</p>
          <h2>Banco de Itens</h2>
          <p>Consulte todos os itens cadastrados do jogo.</p>
        </div>

        <div className="database-total">
          <strong>{gameItems.length}</strong>
          <span>itens cadastrados</span>
        </div>
      </div>

      <div className="database-grid">
        {gameItems.map((item) => (
          <article className="database-card" key={item.id}>
            <div className="database-icon">
              {item.icon ?? "📦"}
            </div>

            <div className="database-card-content">
              <span className="database-category">
                {item.category}
              </span>

              <h3>{item.name}</h3>

              <div className="database-card-footer">
                {item.coinValue !== undefined ? (
                  <span>🪙 {item.coinValue} Coins</span>
                ) : (
                  <span>Sem valor em Coins</span>
                )}

                {item.verified && (
                  <span className="database-verified">
                    ✔ Oficial
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}