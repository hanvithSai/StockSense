import type { NextRequest } from "next/server";
import {
  OPERATION_STATUSES,
  OPERATION_TYPES,
  type OperationStatus,
  type OperationType,
} from "@/lib/constants";
import { listParam, searchParam, todayParam } from "@/server/http";
import type { OperationFilters } from "@/server/services/operation-queries";

/** Reads operation list filters from the query string (shared by operations and move history). */
export function operationFilters(req: NextRequest): OperationFilters {
  const type = searchParam(req, "type") as OperationType | undefined;
  return {
    type: type && OPERATION_TYPES.includes(type) ? type : undefined,
    status: listParam(req, "status")?.filter((status): status is OperationStatus =>
      OPERATION_STATUSES.includes(status as OperationStatus),
    ),
    warehouse: searchParam(req, "warehouse"),
    location: searchParam(req, "location"),
    category: searchParam(req, "category"),
    product: searchParam(req, "product"),
    q: searchParam(req, "q"),
    late: searchParam(req, "late") === "1",
    responsible: searchParam(req, "responsible"),
    today: todayParam(req),
  };
}
