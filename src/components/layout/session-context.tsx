"use client";

import { createContext, useContext, useMemo } from "react";
import { can, type Capability } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** Current user plus a capability check mirroring the API's RBAC rules. */
export function useSession() {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSession must be used within SessionProvider");
  return useMemo(() => ({ user, can: (capability: Capability) => can(user.role, capability) }), [user]);
}
