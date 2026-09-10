import type { FarmLiveLookupResponse, FarmLiveSnapshot } from "./liveData";

export async function loadLiveFarmData(
  farmId: string,
  apiKey: string,
): Promise<FarmLiveSnapshot> {
  const normalizedFarmId = String(farmId ?? "").trim();
  const normalizedApiKey = String(apiKey ?? "").trim();

  if (!/^\d+$/.test(normalizedFarmId)) {
    throw new Error("Informe uma Farm ID numérica válida.");
  }

  if (!normalizedApiKey) {
    throw new Error("Informe sua Farm API Key para carregar os dados reais.");
  }

  const response = await fetch("/api/farm/live", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      farmId: normalizedFarmId,
      apiKey: normalizedApiKey,
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as FarmLiveLookupResponse;

  if (!response.ok || !payload.ok || !payload.snapshot) {
    throw new Error(payload.error || "Não foi possível carregar os dados reais da fazenda.");
  }

  return payload.snapshot;
}
