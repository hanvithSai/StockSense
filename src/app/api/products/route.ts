import { STOCK_STATUSES, type StockStatus } from "@/lib/constants";
import { productCreateSchema } from "@/lib/validation/master";
import { pageParams, parseBody, route, searchParam } from "@/server/http";
import { createProduct, listProducts } from "@/server/services/catalog";
import { getProductOptions } from "@/server/services/stock";

export const GET = route({}, async ({ req }) => {
  if (searchParam(req, "options")) return getProductOptions();
  const stock = searchParam(req, "stock");
  return listProducts(
    {
      q: searchParam(req, "q"),
      category: searchParam(req, "category"),
      warehouse: searchParam(req, "warehouse"),
      location: searchParam(req, "location"),
      stock: STOCK_STATUSES.includes(stock as StockStatus) ? (stock as StockStatus) : undefined,
      archived: searchParam(req, "archived") === "1",
    },
    pageParams(req, 25),
  );
});

export const POST = route({ capability: "master:write" }, async ({ req, user }) => ({
  id: await createProduct(await parseBody(req, productCreateSchema), user),
}));
