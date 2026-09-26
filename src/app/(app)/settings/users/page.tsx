import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { UsersView } from "./users-view";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "users:manage")) redirect("/dashboard");
  return <UsersView />;
}
