"use client";

import { useMemo, useState } from "react";
import { crafts } from "../../lib/gameData";
import CraftCard from "./CraftCard";

export default function CraftsPage() {
  const [search, setSearch] = useState("");
  const [building, setBuilding] = useState("all");

  const buildings = useMemo(() => {
    return Array.from(
      new Set(
        crafts
          .map((craft) => craft.building)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort();
  }, []);

  const filteredCrafts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return crafts.filter((craft) => {
      const matchesSearch =
        normalizedSearch === "" ||
        craft.name.toLowerCase().includes(normalizedSearch) ||
        craft.ingredients.some((ingredient) =>
          ingredient.itemId
            .toLowerCase()
            .includes(normalizedSearch),
        );

      const matchesBuilding =
        building === "all" || craft.building === building;

      return matchesSearch && matchesBuilding;
    });
  }, [search, building]);

  return (
    <div className="crafts-page">
      <div className="database-header">
        <div>
          <p className="database-label">Sunflower Land</p>
          <h2>Banco de Crafts</h2>
          <p>
            Consulte receitas, ingredientes, tempo e prédio de produção.
          </p>
        </div>

        <div className="database-total">
          <strong>{filteredCrafts.length}</strong>
          <span>crafts encontrados</span>
        </div>
      </div>

      <div className="database-filters">
        <input
          type="search"
          placeholder="Pesquisar craft ou ingrediente..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={building}
          onChange={(event) => setBuilding(event.target.value)}
        >
          <option value="all">Todos os prédios</option>

          {buildings.map((buildingName) => (
            <option key={buildingName} value={buildingName}>
              {buildingName}
            </option>
          ))}
        </select>
      </div>

      {filteredCrafts.length > 0 ? (
        <div className="crafts-grid">
          {filteredCrafts.map((craft) => (
            <CraftCard key={craft.id} craft={craft} />
          ))}
        </div>
      ) : (
        <div className="database-empty">
          <h3>Nenhum craft encontrado</h3>
          <p>Tente outro nome, ingrediente ou prédio.</p>
        </div>
      )}
    </div>
  );
}