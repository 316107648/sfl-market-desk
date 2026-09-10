export type CloudStateResult<T> = {
  ok: boolean;
  configured: boolean;
  data?: T;
  updatedAt?: string;
};

export async function loadCloudState<T>(profileId: string, namespace: string): Promise<CloudStateResult<T>> {
  if (!profileId || typeof window === "undefined") return { ok: false, configured: false };
  try {
    const params = new URLSearchParams({ profileId, namespace });
    const response = await fetch(`/api/cloud/state?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return { ok: false, configured: response.status !== 503 };
    return await response.json();
  } catch {
    return { ok: false, configured: false };
  }
}

export async function saveCloudState<T>(profileId: string, namespace: string, data: T): Promise<CloudStateResult<T>> {
  if (!profileId || typeof window === "undefined") return { ok: false, configured: false };
  try {
    const response = await fetch("/api/cloud/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId, namespace, data }),
    });
    if (!response.ok) return { ok: false, configured: response.status !== 503 };
    return await response.json();
  } catch {
    return { ok: false, configured: false };
  }
}

export async function saveCloudFarmSnapshot(snapshot: unknown, farmId: string, fetchedAt: string | number) {
  if (!farmId || typeof window === "undefined") return;
  try {
    await fetch("/api/cloud/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ farmId, fetchedAt, snapshot }),
      keepalive: true,
    });
  } catch {
    // Nuvem é complemento. A tela continua funcionando se o Render/DB estiver indisponível.
  }
}
