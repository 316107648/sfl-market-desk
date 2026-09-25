import { NextRequest, NextResponse } from "next/server";
import { cloudDatabaseConfigured, ensureCloudSchema, getPool } from "../../../../lib/cloud/db";
import { getRequestUser, scopedProfileId } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: NextRequest) {
  if (!cloudDatabaseConfigured()) {
    return NextResponse.json({ ok: false, configured: false }, { status: 503 });
  }
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ ok: false, configured: true, error: "Não autenticado." }, { status: 401 });

  const profileId = clean(request.nextUrl.searchParams.get("profileId"));
  const namespace = clean(request.nextUrl.searchParams.get("namespace"));
  if (!profileId || !namespace) {
    return NextResponse.json({ ok: false, configured: true, error: "profileId e namespace são obrigatórios." }, { status: 400 });
  }

  await ensureCloudSchema();
  const result = await getPool().query(
    "SELECT data, updated_at FROM app_state WHERE profile_id = $1 AND namespace = $2 LIMIT 1",
    [scopedProfileId(user.id, profileId), namespace],
  );

  if (!result.rowCount) return NextResponse.json({ ok: true, configured: true, data: null });
  return NextResponse.json({ ok: true, configured: true, data: result.rows[0].data, updatedAt: result.rows[0].updated_at });
}

export async function PUT(request: NextRequest) {
  if (!cloudDatabaseConfigured()) {
    return NextResponse.json({ ok: false, configured: false }, { status: 503 });
  }
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ ok: false, configured: true, error: "Não autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const profileId = clean(body?.profileId);
  const namespace = clean(body?.namespace);
  if (!profileId || !namespace || body?.data === undefined) {
    return NextResponse.json({ ok: false, configured: true, error: "Dados inválidos." }, { status: 400 });
  }

  await ensureCloudSchema();
  const result = await getPool().query(
    `INSERT INTO app_state (profile_id, namespace, data, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (profile_id, namespace)
     DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
     RETURNING updated_at`,
    [scopedProfileId(user.id, profileId), namespace, JSON.stringify(body.data)],
  );

  return NextResponse.json({ ok: true, configured: true, data: body.data, updatedAt: result.rows[0].updated_at });
}
