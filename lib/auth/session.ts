import "server-only";
import { createHash, randomBytes, randomUUID } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { ensureCloudSchema, getPool } from "../cloud/db";

export const SESSION_COOKIE = "smp_session";
const SESSION_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  plan: "free" | "vip";
};

function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createUserSession(userId: string) {
  await ensureCloudSchema();
  const raw = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getPool().query(
    `INSERT INTO user_sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), userId, digest(raw), expires.toISOString()],
  );
  return { raw, expires };
}

export function setSessionCookie(response: NextResponse, raw: string, expires: Date) {
  response.cookies.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getRequestUser(request: NextRequest): Promise<AuthUser | null> {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  await ensureCloudSchema();
  const result = await getPool().query(
    `SELECT u.id, u.email, u.name, u.plan
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()
      LIMIT 1`,
    [digest(raw)],
  );
  if (!result.rowCount) return null;
  return result.rows[0] as AuthUser;
}

export async function deleteRequestSession(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return;
  await ensureCloudSchema();
  await getPool().query("DELETE FROM user_sessions WHERE token_hash = $1", [digest(raw)]);
}

export function scopedProfileId(userId: string, profileId: string) {
  return `${userId}:${profileId}`;
}
