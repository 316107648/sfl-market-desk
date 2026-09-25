import { NextResponse } from "next/server";
import { cloudDatabaseConfigured, ensureCloudSchema, getPool } from "../../../../lib/cloud/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!cloudDatabaseConfigured()) {
    return NextResponse.json({ ok: false, configured: false, database: "missing" }, { status: 503 });
  }
  try {
    await ensureCloudSchema();
    await getPool().query("SELECT 1");
    return NextResponse.json({ ok: true, configured: true, database: "connected" });
  } catch (error) {
    return NextResponse.json(
      { ok: false, configured: true, database: "error", error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 },
    );
  }
}
