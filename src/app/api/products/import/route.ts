import { productImportSchema } from "@/lib/validation/master";
import { parseBody, route } from "@/server/http";
import { importProducts } from "@/server/services/catalog";

/** Bulk product import from spreadsheet rows; returns a per-row report. */
export const POST = route({ capability: "master:write" }, async ({ req, user }) =>
  importProducts(await parseBody(req, productImportSchema), user),
);
