import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, LEGACY_ADMIN_COOKIE } from "@/lib/auth";

export async function POST() {
  cookies().delete(SESSION_COOKIE);
  cookies().delete(LEGACY_ADMIN_COOKIE);
  return NextResponse.json({ ok: true });
}
