import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, LEGACY_ADMIN_COOKIE } from "@/lib/auth";
import LoginClient from "./login-client";

export const metadata = { title: "Admin Login — bikepick.in" };

export default function AdminPage() {
  // Already logged in? Go straight to the dashboard.
  const session = legacyVerifyAdminSession(cookies().get(LEGACY_ADMIN_COOKIE)?.value);
  if (session) redirect("/admin/dashboard");
  return <LoginClient />;
}
