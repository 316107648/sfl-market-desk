import { NextResponse } from "next/server";
import { normalizePrices } from "../../../lib/market";

const SOURCES = ["https://sfl.world/api/v1/prices"];

export const revalidate = 300;

export async function GET() {
  let lastError = "Fuente no disponible";

  for (const source of SOURCES) {
    try {
      const response = await fetch(source, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Sunflower-Market-Pro/0.1",
        },
        next: { revalidate: 300 },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const prices = normalizePrices(payload);

      return NextResponse.json({
        ok: true,
        source,
        updatedAt: new Date().toISOString(),
        count: Object.keys(prices).length,
        prices,
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json({ ok: false, error: lastError }, { status: 502 });
}
