import { NextRequest, NextResponse } from "next/server";
import { cloudDatabaseConfigured } from "../../../../lib/cloud/db";
import { getRequestUser } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!cloudDatabaseConfigured()) return NextResponse.json({ ok: false, configured: false, user: null }, { status: 503 });
  const user = await getRequestUser(request);
  return NextResponse.json({ ok: true, configured: true, user });
}
