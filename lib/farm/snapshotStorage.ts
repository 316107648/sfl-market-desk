import { saveCloudFarmSnapshot } from "../cloud/client";
import type { FarmLiveSnapshot } from "./liveData";

const KEY = "sfl-market:last-farm-snapshot:v1";

export type StoredFarmSnapshot = Pick<
  FarmLiveSnapshot,
  "farmId" | "fetchedAt" | "inventory" | "boosts" | "collectibles" | "summary"
>;

export function saveStoredFarmSnapshot(snapshot: FarmLiveSnapshot) {
  if (typeof window === "undefined") return;
  const compact: StoredFarmSnapshot = {
    farmId: snapshot.farmId,
    fetchedAt: snapshot.fetchedAt,
    inventory: snapshot.inventory,
    boosts: snapshot.boosts,
    collectibles: snapshot.collectibles,
    summary: snapshot.summary,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(compact));
  } catch {
    // Storage is a convenience only. Never break the farm page if it is unavailable.
  }

  // Cloud Data Vault: salva um snapshot histórico sem persistir a Farm API Key.
  void saveCloudFarmSnapshot(compact, snapshot.farmId, snapshot.fetchedAt);
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
