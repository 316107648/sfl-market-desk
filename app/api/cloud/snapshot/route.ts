import { NextRequest, NextResponse } from "next/server";
import { cloudDatabaseConfigured, ensureCloudSchema, getPool } from "../../../../lib/cloud/db";
import { getRequestUser } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!cloudDatabaseConfigured()) return NextResponse.json({ ok: false, configured: false }, { status: 503 });
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ ok: false, configured: true, error: "Não autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const farmId = typeof body?.farmId === "string" ? body.farmId.trim().slice(0, 80) : "";
  const fetchedAt = body?.fetchedAt;
  const snapshot = body?.snapshot;
  if (!farmId || !snapshot) return NextResponse.json({ ok: false, configured: true, error: "Snapshot inválido." }, { status: 400 });

  const parsedDate = new Date(typeof fetchedAt === "number" ? fetchedAt : String(fetchedAt || Date.now()));
  if (Number.isNaN(parsedDate.getTime())) return NextResponse.json({ ok: false, configured: true, error: "fetchedAt inválido." }, { status: 400 });

  await ensureCloudSchema();
  await getPool().query(
    `INSERT INTO farm_snapshots (user_id, farm_id, fetched_at, snapshot)
     SELECT $1, $2, $3, $4::jsonb
     WHERE NOT EXISTS (
       SELECT 1 FROM farm_snapshots WHERE user_id = $1 AND farm_id = $2 AND fetched_at = $3
     )`,
    [user.id, farmId, parsedDate.toISOString(), JSON.stringify(snapshot)],
  );
  return NextResponse.json({ ok: true, configured: true });
}
