import { stockUpdateSchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { applyStockCount } from "@/server/services/inventory";

/** Quick stock update: books the counted quantity as an applied inventory adjustment. */
export const POST = route({ capability: "stock:move" }, async ({ req, user }) =>
  applyStockCount(await parseBody(req, stockUpdateSchema), user),
);
