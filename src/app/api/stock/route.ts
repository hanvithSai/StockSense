import { STOCK_STATUSES, type StockStatus } from "@/lib/constants";
import { route, searchParam } from "@/server/http";
import { getStockOverview } from "@/server/services/stock";

export const GET = route({}, async ({ req }) => {
  const stock = searchParam(req, "stock") as StockStatus | undefined;
  const rows = await getStockOverview({
    q: searchParam(req, "q"),
    category: searchParam(req, "category"),
    warehouse: searchParam(req, "warehouse"),
    location: searchParam(req, "location"),
  });
  return stock && STOCK_STATUSES.includes(stock) ? rows.filter((row) => row.status === stock) : rows;
});
