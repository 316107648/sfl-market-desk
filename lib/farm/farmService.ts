import type { FarmProfile } from "./types";

export const DEFAULT_FARM_PROFILE: FarmProfile = {
  landId: "",
  bumpkinLevel: 1,
  cropPlots: 8,
  activeHoursPerDay: 4,
  updatedAt: Date.now(),
};

const FARM_PROFILE_KEY = "smp-farm-profile-v1";

export function loadFarmProfile(): FarmProfile {
  if (typeof window === "undefined") return DEFAULT_FARM_PROFILE;

  try {
    const raw = window.localStorage.getItem(FARM_PROFILE_KEY);
    if (!raw) return DEFAULT_FARM_PROFILE;

    const parsed = JSON.parse(raw) as Partial<FarmProfile>;
    return normalizeFarmProfile(parsed);
  } catch {
    return DEFAULT_FARM_PROFILE;
  }
}

export function saveFarmProfile(profile: FarmProfile): FarmProfile {
  const normalized = normalizeFarmProfile({
    ...profile,
    updatedAt: Date.now(),
  });

  if (typeof window !== "undefined") {
    window.localStorage.setItem(FARM_PROFILE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}

export function normalizeFarmProfile(profile: Partial<FarmProfile>): FarmProfile {
  return {
    landId: String(profile.landId ?? "").trim(),
    bumpkinLevel: clampInteger(profile.bumpkinLevel, 1, 999, 1),
    cropPlots: clampInteger(profile.cropPlots, 1, 999, 8),
    activeHoursPerDay: clampNumber(profile.activeHoursPerDay, 0.5, 24, 4),
    updatedAt: Number.isFinite(Number(profile.updatedAt))
      ? Number(profile.updatedAt)
      : Date.now(),
  };
}

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}
