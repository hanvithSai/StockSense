import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { AuditLogView } from "./audit-log-view";

export const metadata: Metadata = { title: "Audit Log" };

export default async function AuditLogPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "users:manage")) redirect("/dashboard");
  return <AuditLogView />;
}
