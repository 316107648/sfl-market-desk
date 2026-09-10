import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, deleteRequestSession } from "../../../../lib/auth";

export async function POST(request: NextRequest) {
  await deleteRequestSession(request).catch(() => undefined);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
