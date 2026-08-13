import type { CraftData } from "../../lib/gameData";
import { getItemDetails } from "../../lib";

type CraftCardProps = {
  craft: CraftData;
};

export default function CraftCard({ craft }: CraftCardProps) {
  const details = getItemDetails(craft.id);
  const wiki = details?.wiki;

  return (
    <article className="craft-card">
      <div className="craft-card-header">
        <div className="craft-icon">
          {craft.icon ?? "🛠️"}
        </div>

        <div>
          <span className="craft-building">
            {craft.building ?? "Prédio não informado"}
          </span>

          <h3>{craft.name}</h3>
        </div>
      </div>

      {wiki?.description && (
        <p className="craft-description">
          {wiki.description}
        </p>
      )}

           <span className="craft-building">
            {craft.building ?? "Prédio não informado"}
          </span>

      <div className="craft-details">
        {craft.craftingTimeSeconds !== undefined && (
          <span>
            ⏱️ {formatCraftTime(craft.craftingTimeSeconds)}
          </span>
        )}

        {craft.xp !== undefined && (
          <span>⭐ {craft.xp} XP</span>
        )}

        {craft.coinValue !== undefined && (
          <span>🪙 {craft.coinValue} Coins</span>
        )}
      </div>

      <div className="craft-ingredients">
        <strong>Ingredientes</strong>

        {craft.ingredients.map((ingredient) => (
          <div
            className="craft-ingredient"
            key={`${craft.id}-${ingredient.itemId}`}
          >
            <span>{ingredient.itemId}</span>
            <strong>× {ingredient.amount}</strong>
          </div>
        ))}
      </div>

      <div className="craft-footer">
        <span>
          Nível {craft.requiredLevel ?? "—"}
        </span>

        <span className={craft.verified ? "database-verified" : ""}>
          {craft.verified ? "✔ Oficial" : "Dados manuais"}
        </span>
      </div>
    </article>
  );
}

function formatCraftTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes} min`;
}