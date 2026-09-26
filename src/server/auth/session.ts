import { cookies } from "next/headers";
import { isValidObjectId } from "mongoose";
import type { SessionUser } from "@/lib/types";
import { connectDB } from "@/server/db";
import { User, type UserRecord } from "@/server/models/user";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSessionToken,
  verifySessionToken,
} from "./token";

export function toSessionUser(user: Pick<UserRecord, "_id" | "loginId" | "email" | "name" | "role">): SessionUser {
  return {
    id: user._id.toString(),
    loginId: user.loginId,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function startSession(user: Pick<UserRecord, "_id" | "sessionVersion">) {
  const token = await signSessionToken({
    userId: user._id.toString(),
    sessionVersion: user.sessionVersion ?? 0,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Resolves the signed-in user from the session cookie. The user is re-read from the
 * database so deactivation, role changes and password resets take effect immediately.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims || !isValidObjectId(claims.userId)) return null;

  await connectDB();
  const user = await User.findById(claims.userId).lean<UserRecord>();
  if (!user || !user.isActive || (user.sessionVersion ?? 0) !== claims.sessionVersion) return null;
  return toSessionUser(user);
}
