import { route } from "@/server/http";
import { replenishLowStock } from "@/server/services/catalog";

/** Creates draft receipts for every product at or below its reorder minimum. */
export const POST = route({ capability: "operation:plan" }, async ({ user }) => ({
  references: await replenishLowStock(user),
}));
