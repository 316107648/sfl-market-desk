"use client";

import { useMemo, useState } from "react";
import { items } from "../../lib/gameData";
import type { GameCategory } from "../../lib/gameData";

const categories: Array<{
  value: "all" | GameCategory;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "crop", label: "Plantações" },
  { value: "fruit", label: "Frutas" },
  { value: "flower", label: "Flores" },
  { value: "resource", label: "Recursos" },
  { value: "fish", label: "Peixes" },
  { value: "animal", label: "Animais" },
  { value: "food", label: "Comidas" },
];

export default function DatabasePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] =
    useState<"all" | GameCategory>("all");

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        normalizedSearch === "" ||
        item.name.toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        category === "all" || item.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [search, category]);

  return (
    <main className="database-page">
      <header className="database-header">
        <div>
          <p className="database-label">Sunflower Land</p>
          <h1>Banco de Itens</h1>
          <p>
            Consulte todos os itens cadastrados do jogo.
          </p>
        </div>

        <div className="database-total">
          <strong>{filteredItems.length}</strong>
          <span>itens encontrados</span>
        </div>
      </header>

      <section className="database-filters">
        <input
          type="search"
          placeholder="Pesquisar item..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as "all" | GameCategory)
          }
        >
          {categories.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      {filteredItems.length === 0 ? (
        <section className="database-empty">
          <h2>Nenhum item encontrado</h2>
          <p>Tente outro filtro ou pesquisa.</p>
        </section>
      ) : (
        <section className="database-grid">
          {filteredItems.map((item) => (
            <article className="database-card" key={item.id}>
              <div className="database-icon">
                {item.icon ?? getCategoryEmoji(item.category)}
              </div>

              <div className="database-card-content">
                <span className="database-category">
                  {getCategoryLabel(item.category)}
                </span>

                <h2>{item.name}</h2>

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
        </section>
      )}
    </main>
  );
}

function getCategoryLabel(category: GameCategory): string {
  const labels: Record<GameCategory, string> = {
    crop: "Plantação",
    fruit: "Fruta",
    flower: "Flor",
    resource: "Recurso",
    fish: "Peixe",
    animal: "Animal",
    food: "Comida",
  };

  return labels[category];
}

function getCategoryEmoji(category: GameCategory): string {
  const emojis: Record<GameCategory, string> = {
    crop: "🌾",
    fruit: "🍎",
    flower: "🌸",
    resource: "🪨",
    fish: "🐟",
    animal: "🐄",
    food: "🍲",
  };

  return emojis[category];
}