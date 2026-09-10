import type { CraftData } from "../../lib/gameData";
import type { PriceMap } from "../../lib/market";
import { getItemDetails } from "../../lib";
import type { CraftEconomics } from "./CraftsPage";

type CraftCardProps = {
  craft: CraftData;
  prices: PriceMap;
  economics: CraftEconomics;
  quantity: number;
  feePct: number;
};

function priceFor(prices: PriceMap, name: string): number | undefined {
  if (prices[name] !== undefined) return prices[name];
  const target = name.trim().toLowerCase();
  return Object.entries(prices).find(([key]) => key.trim().toLowerCase() === target)?.[1];
}

export default function CraftCard({ craft, prices, economics, quantity, feePct }: CraftCardProps) {
  const details = getItemDetails(craft.id);
  const wiki = details?.wiki;
  const verdict = !economics.complete
    ? { label: "FALTA PREÇO", cls: "unknown" }
    : economics.profit > 0
      ? { label: "VALE CRAFTAR", cls: "positive" }
      : economics.profit < 0
        ? { label: "MELHOR NÃO CRAFTAR", cls: "negative" }
        : { label: "EMPATE", cls: "neutral" };

  return (
    <article className={`craft-card craft-profit-card ${verdict.cls}`}>
      <div className="craft-card-header">
        <div className="craft-icon">{craft.icon ?? "🛠️"}</div>
        <div>
          <span className="craft-building">{craft.building ?? "Prédio não informado"}</span>
          <h3>{craft.name}</h3>
        </div>
        <span className={`craft-verdict ${verdict.cls}`}>{verdict.label}</span>
      </div>

      {wiki?.description && <p className="craft-description">{wiki.description}</p>}

      <div className="craft-details">
        {craft.craftingTimeSeconds !== undefined && <span>⏱️ {formatCraftTime(craft.craftingTimeSeconds)}</span>}
        {craft.xp !== undefined && <span>⭐ {craft.xp} XP</span>}
        {quantity > 1 && <span>📦 × {quantity}</span>}
      </div>

      <div className="craft-ingredients">
        <strong>Ingredientes</strong>
        {craft.ingredients.map((ingredient) => {
          const unitPrice = priceFor(prices, ingredient.itemId);
          return (
            <div className="craft-ingredient" key={`${craft.id}-${ingredient.itemId}`}>
              <span>{ingredient.itemId} × {ingredient.amount * quantity}</span>
              <strong>{unitPrice === undefined ? "sem preço" : `${(unitPrice * ingredient.amount * quantity).toFixed(6)} FLOWER`}</strong>
            </div>
          );
        })}
      </div>

      <div className="craft-economics">
        <div><span>Custo dos ingredientes</span><strong>{economics.materialCost.toFixed(6)} FLOWER</strong></div>
        <div><span>Venda bruta</span><strong>{economics.grossRevenue.toFixed(6)} FLOWER</strong></div>
        {feePct > 0 && <div><span>Venda líquida ({feePct}% taxa)</span><strong>{economics.netRevenue.toFixed(6)} FLOWER</strong></div>}
        <div className="craft-profit-main"><span>Lucro / prejuízo</span><strong>{economics.profit >= 0 ? "+" : ""}{economics.profit.toFixed(6)} FLOWER</strong></div>
        <div><span>Margem sobre custo</span><strong>{economics.marginPct === null ? "—" : `${economics.marginPct >= 0 ? "+" : ""}${economics.marginPct.toFixed(2)}%`}</strong></div>
        <div><span>Lucro por hora</span><strong>{economics.profitPerHour === null ? "—" : `${economics.profitPerHour >= 0 ? "+" : ""}${economics.profitPerHour.toFixed(6)} FLOWER/h`}</strong></div>
      </div>

      {!economics.complete && (
        <div className="craft-missing-price">
          Sem preço de mercado para: {economics.missingPrices.join(", ")}. O resultado acima ainda não é conclusivo.
        </div>
      )}

      <div className="craft-footer">
        <span>Nível {craft.requiredLevel ?? "—"}</span>
        <span className={craft.verified ? "database-verified" : ""}>{craft.verified ? "✔ Oficial" : "Dados manuais"}</span>
      </div>
    </article>
  );
}

function formatCraftTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
}
