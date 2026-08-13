import { getItemDetails } from "../../lib";

type ItemDetailsProps = {
  itemId: string;
  onClose?: () => void;
};

export default function ItemDetails({
  itemId,
  onClose,
}: ItemDetailsProps) {
  const details = getItemDetails(itemId);

  if (!details) {
    return (
      <section className="item-details">
        <p>Item não encontrado.</p>

        {onClose && (
          <button type="button" onClick={onClose}>
            Fechar
          </button>
        )}
      </section>
    );
  }

  const { item, wiki, relatedItems, producedBy, usedIn } = details;

  return (
    <section className="item-details">
      <header className="item-details-header">
        <div className="item-details-icon">
          {item.icon ?? "📦"}
        </div>

        <div>
          <span className="database-category">
            {item.category}
          </span>

          <h2>{item.name}</h2>
        </div>

        {onClose && (
          <button
            type="button"
            className="item-details-close"
            onClick={onClose}
          >
            Fechar
          </button>
        )}
      </header>

      {wiki?.description && (
        <div className="item-details-section">
          <h3>Descrição</h3>
          <p>{wiki.description}</p>
        </div>
      )}

      <div className="item-details-section">
        <h3>Informações</h3>

        <div className="item-details-grid">
          <span>Categoria</span>
          <strong>{item.category}</strong>

          <span>Valor em Coins</span>
          <strong>
            {item.coinValue !== undefined
              ? item.coinValue
              : "Não informado"}
          </strong>

          <span>Nível necessário</span>
          <strong>{item.requiredLevel ?? "Não informado"}</strong>

          <span>Raridade</span>
          <strong>{item.rarity ?? "Não informada"}</strong>

          <span>Tradável</span>
          <strong>
            {item.tradable === undefined
              ? "Não informado"
              : item.tradable
                ? "Sim"
                : "Não"}
          </strong>
        </div>
      </div>

      {usedIn.length > 0 && (
        <div className="item-details-section">
          <h3>Usado em</h3>

          <ul>
            {usedIn.map((craft) => (
              <li key={craft.id}>
                {craft.icon ?? "🛠️"} {craft.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {producedBy.length > 0 && (
        <div className="item-details-section">
          <h3>Produzido por</h3>

          <ul>
            {producedBy.map((source) => (
              <li key={source.id}>
                {source.icon ?? "📦"} {source.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {relatedItems.length > 0 && (
        <div className="item-details-section">
          <h3>Itens relacionados</h3>

          <ul>
            {relatedItems.map((relatedItem) => (
              <li key={relatedItem.id}>
                {relatedItem.icon ?? "📦"} {relatedItem.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {wiki && wiki.tips.length > 0 && (
        <div className="item-details-section">
          <h3>Dicas</h3>

          <ul>
            {wiki.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {wiki && wiki.strategy.length > 0 && (
        <div className="item-details-section">
          <h3>Estratégia</h3>

          <ul>
            {wiki.strategy.map((strategy) => (
              <li key={strategy}>{strategy}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}