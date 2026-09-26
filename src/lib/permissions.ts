import type { OperationType, Role } from "./constants";

/**
 * Capabilities are checked by every API route (source of truth) and mirrored in the UI.
 * - master:write       products, categories, reordering rules, warehouses, locations
 * - operation:plan     create / edit / cancel receipts and delivery orders
 * - operation:process  To Do, check availability, pick, pack, validate
 * - stock:move         internal transfers, inventory adjustments, quick stock updates
 * - users:manage       change roles and deactivate users
 */
export type Capability =
  | "master:write"
  | "operation:plan"
  | "operation:process"
  | "stock:move"
  | "users:manage";

const MATRIX: Record<Role, readonly Capability[]> = {
  manager: ["master:write", "operation:plan", "operation:process", "stock:move", "users:manage"],
  staff: ["operation:process", "stock:move"],
};

export function can(role: Role | null | undefined, capability: Capability): boolean {
  return role ? MATRIX[role].includes(capability) : false;
}

/** Capability required to create, edit, cancel or delete an operation of the given type. */
export function manageCapability(type: OperationType): Capability {
  return type === "receipt" || type === "delivery" ? "operation:plan" : "stock:move";
}
