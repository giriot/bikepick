import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, LEGACY_ADMIN_COOKIE } from "@/lib/auth";
import AdminDashboard from "./admin-dashboard";

export const metadata = { title: "Product Catalog — bikepick.in Admin" };

export default function DashboardPage() {
  const session = legacyVerifyAdminSession(cookies().get(LEGACY_ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin");
  return <AdminDashboard username={session} />;
}
