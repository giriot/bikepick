import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  legacyVerifyCredentials,
  createSession,
  LEGACY_ADMIN_COOKIE,
  LEGACY_ADMIN_SESSION_MAX_AGE,
} from "@/lib/auth";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const { username, password } = body || {};
  if (!legacyVerifyCredentials(username, password)) {
    return NextResponse.json({ ok: false, error: "Invalid username or password" }, { status: 401 });
  }
  const session = legacyCreateAdminSession(username);
  cookies().set(LEGACY_ADMIN_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: LEGACY_ADMIN_SESSION_MAX_AGE,
  });
  return NextResponse.json({ ok: true, username });
}
