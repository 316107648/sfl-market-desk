import type {
  FarmPublicLookupResponse,
  FarmPublicSnapshot,
} from "./publicData";

export async function loadPublicFarmData(
  landId: string,
): Promise<FarmPublicSnapshot> {
  const normalizedLandId = String(landId ?? "").trim();

  if (!/^\d+$/.test(normalizedLandId)) {
    throw new Error("Informe uma Land ID numérica válida.");
  }

  const response = await fetch(
    `/api/farm/public?landId=${encodeURIComponent(normalizedLandId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as FarmPublicLookupResponse;

  if (!response.ok || !payload.ok || !payload.snapshot) {
    throw new Error(payload.error || "Não foi possível consultar a fazenda.");
  }

  return payload.snapshot;
}
