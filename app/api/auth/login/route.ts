import { NextRequest, NextResponse } from "next/server";
import { cloudDatabaseConfigured, ensureCloudSchema, getPool } from "../../../../lib/cloud/db";
import { createUserSession, setSessionCookie, verifyPassword } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!cloudDatabaseConfigured()) return NextResponse.json({ ok: false, error: "Banco não configurado." }, { status: 503 });
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 190) : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ ok: false, error: "Informe e-mail e senha." }, { status: 400 });

  await ensureCloudSchema();
  const result = await getPool().query(
    "SELECT id, email, name, plan, password_hash FROM users WHERE email = $1 LIMIT 1",
    [email],
  );
  if (!result.rowCount || !(await verifyPassword(password, result.rows[0].password_hash))) {
    return NextResponse.json({ ok: false, error: "E-mail ou senha incorretos." }, { status: 401 });
  }
  const user = result.rows[0];
  const session = await createUserSession(user.id);
  const response = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  setSessionCookie(response, session.raw, session.expires);
  return response;
}
