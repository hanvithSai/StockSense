import bcrypt from "bcryptjs";

const COST = 10;
// Compared against when the user does not exist, so login timing does not reveal accounts.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.JV9Y7m4zLkzv7lU0Ij3yGmM0Yj0K";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}
