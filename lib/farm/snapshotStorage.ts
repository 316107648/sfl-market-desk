import { saveCloudFarmSnapshot, saveCloudState } from "../cloud/client";
import type { FarmLiveSnapshot } from "./liveData";

const KEY = "sfl-market:last-farm-snapshot:v2";

export type StoredFarmSnapshot = FarmLiveSnapshot;

function compactForCloud(snapshot: FarmLiveSnapshot): FarmLiveSnapshot {
  // Mantemos os dados necessários para restaurar toda a Fazenda no próximo login.
  // A Farm API Key nunca faz parte do snapshot.
  return {
    ...snapshot,
    animals: snapshot.animals.map((animal) => ({
      ...animal,
      // rawData pode ser grande. Os campos diagnosticados continuam salvos.
      rawData: animal.rawData,
    })),
  };
}

export function saveStoredFarmSnapshot(snapshot: FarmLiveSnapshot) {
  if (typeof window === "undefined") return;
  const stored = compactForCloud(snapshot);

  try {
    window.localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Cache local é apenas conveniência.
  }

  // Estado atual: sobrescreve e permite restaurar a Fazenda em outro dispositivo.
  void saveCloudState(snapshot.farmId, "farm_latest_snapshot", stored);

  // Histórico: registra pontos no tempo para análises futuras.
  void saveCloudFarmSnapshot(stored, snapshot.farmId, snapshot.fetchedAt);
}

export function loadStoredFarmSnapshot(): StoredFarmSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredFarmSnapshot;
  } catch {
    return null;
  }
}
