import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cloudDatabaseConfigured, ensureCloudSchema, getPool } from "../../../../lib/cloud/db";
import { createUserSession, hashPassword, setSessionCookie } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

function emailOf(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 190) : "";
}

export async function POST(request: NextRequest) {
  if (!cloudDatabaseConfigured()) return NextResponse.json({ ok: false, error: "Banco não configurado." }, { status: 503 });
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const email = emailOf(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!name || !email.includes("@") || password.length < 8) {
    return NextResponse.json({ ok: false, error: "Informe nome, e-mail válido e senha com pelo menos 8 caracteres." }, { status: 400 });
  }

  await ensureCloudSchema();
  const exists = await getPool().query("SELECT 1 FROM users WHERE email = $1 LIMIT 1", [email]);
  if (exists.rowCount) return NextResponse.json({ ok: false, error: "Este e-mail já está cadastrado." }, { status: 409 });

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  await getPool().query(
    `INSERT INTO users (id, email, name, password_hash, plan) VALUES ($1, $2, $3, $4, 'free')`,
    [id, email, name, passwordHash],
  );
  const session = await createUserSession(id);
  const response = NextResponse.json({ ok: true, user: { id, email, name, plan: "free" } });
  setSessionCookie(response, session.raw, session.expires);
  return response;
}
