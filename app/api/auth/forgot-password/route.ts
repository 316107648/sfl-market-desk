import { createHash, randomBytes, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cloudDatabaseConfigured, ensureCloudSchema, getPool } from "../../../../lib/cloud/db";

export const dynamic = "force-dynamic";

function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function emailOf(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 190) : "";
}

export async function POST(request: NextRequest) {
  if (!cloudDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Banco não configurado." }, { status: 503 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from = process.env.PASSWORD_RESET_FROM?.trim() || "";
  if (!apiKey || !from) {
    return NextResponse.json(
      { ok: false, error: "Recuperação por e-mail ainda não foi configurada no servidor." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = emailOf(body?.email);
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
  }

  await ensureCloudSchema();
  const userResult = await getPool().query(
    "SELECT id, email, name FROM users WHERE email = $1 LIMIT 1",
    [email],
  );

  if (!userResult.rowCount) return NextResponse.json({ ok: true });

  const user = userResult.rows[0];
  const raw = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 30 * 60 * 1000);

  await getPool().query(
    "DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at <= NOW() OR used_at IS NOT NULL",
    [user.id],
  );
  await getPool().query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), user.id, digest(raw), expires.toISOString()],
  );

  const resetUrl = `${request.nextUrl.origin}/?reset_token=${encodeURIComponent(raw)}`;

  const mailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: "Redefinir senha - Sunflower Market Pro",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
          <h2>Redefinir sua senha</h2>
          <p>Olá, ${String(user.name || "jogador")}.</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta do Sunflower Market Pro.</p>
          <p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#222;color:#fff;text-decoration:none;border-radius:8px">Criar nova senha</a></p>
          <p>Este link expira em 30 minutos e só pode ser usado uma vez.</p>
          <p>Se você não solicitou a troca, ignore este e-mail.</p>
        </div>
      `,
    }),
  });

  if (!mailResponse.ok) {
    await getPool().query("DELETE FROM password_reset_tokens WHERE token_hash = $1", [digest(raw)]);
    return NextResponse.json(
      { ok: false, error: "Não foi possível enviar o e-mail de recuperação agora." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
