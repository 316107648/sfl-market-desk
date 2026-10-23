import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cloudDatabaseConfigured, ensureCloudSchema, getPool } from "../../../../lib/cloud/db";
import { hashPassword } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  if (!cloudDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Banco não configurado." }, { status: 503 });
  }

  const configuredKey = process.env.ADMIN_RESET_KEY?.trim() || "";
  if (!configuredKey) {
    return NextResponse.json({ ok: false, error: "Recuperação administrativa não configurada." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const adminKey = typeof body?.adminKey === "string" ? body.adminKey : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 190) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!adminKey || !safeEqual(adminKey, configuredKey)) {
    return NextResponse.json({ ok: false, error: "Chave administrativa inválida." }, { status: 403 });
  }
  if (!email.includes("@") || password.length < 8) {
    return NextResponse.json({ ok: false, error: "Informe e-mail válido e nova senha com pelo menos 8 caracteres." }, { status: 400 });
  }

  await ensureCloudSchema();
  const user = await getPool().query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
  if (!user.rowCount) {
    return NextResponse.json({ ok: false, error: "Conta não encontrada." }, { status: 404 });
  }

  const passwordHash = await hashPassword(password);
  await getPool().query(
    "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
    [passwordHash, user.rows[0].id],
  );
  await getPool().query("DELETE FROM user_sessions WHERE user_id = $1", [user.rows[0].id]);

  return NextResponse.json({ ok: true });
}
