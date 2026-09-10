import { NextRequest, NextResponse } from "next/server";
import { cloudDatabaseConfigured, ensureCloudSchema, getPool } from "../../../../lib/cloud/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!cloudDatabaseConfigured()) {
    return NextResponse.json({ ok: false, configured: false }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const farmId = typeof body?.farmId === "string" ? body.farmId.trim().slice(0, 80) : "";
  const fetchedAt = body?.fetchedAt;
  const snapshot = body?.snapshot;
  if (!farmId || !snapshot) {
    return NextResponse.json({ ok: false, configured: true, error: "Snapshot inválido." }, { status: 400 });
  }

  const parsedDate = new Date(typeof fetchedAt === "number" ? fetchedAt : String(fetchedAt || Date.now()));
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ ok: false, configured: true, error: "fetchedAt inválido." }, { status: 400 });
  }

  await ensureCloudSchema();
  await getPool().query(
    `INSERT INTO farm_snapshots (farm_id, fetched_at, snapshot)
     SELECT $1, $2, $3::jsonb
     WHERE NOT EXISTS (
       SELECT 1 FROM farm_snapshots WHERE farm_id = $1 AND fetched_at = $2
     )`,
    [farmId, parsedDate.toISOString(), JSON.stringify(snapshot)],
  );

  return NextResponse.json({ ok: true, configured: true });
}
