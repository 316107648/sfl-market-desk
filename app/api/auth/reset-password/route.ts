import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cloudDatabaseConfigured, ensureCloudSchema, getPool } from "../../../../lib/cloud/db";
import { hashPassword } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  if (!cloudDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Banco não configurado." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token || password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Link inválido ou senha com menos de 8 caracteres." },
      { status: 400 },
    );
  }

  await ensureCloudSchema();
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, user_id
         FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
        FOR UPDATE`,
      [digest(token)],
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { ok: false, error: "Este link de recuperação é inválido ou expirou." },
        { status: 400 },
      );
    }

    const row = result.rows[0];
    const passwordHash = await hashPassword(password);

    await client.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [passwordHash, row.user_id],
    );
    await client.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1", [row.id]);
    await client.query("DELETE FROM user_sessions WHERE user_id = $1", [row.user_id]);
    await client.query("COMMIT");

    return NextResponse.json({ ok: true });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return NextResponse.json(
      { ok: false, error: "Não foi possível redefinir a senha agora." },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
