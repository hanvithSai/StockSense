import type { ClientSession } from "mongoose";
import { OPERATION_META, type OperationType } from "@/lib/constants";
import { Counter } from "@/server/models/counter";

/** Next reference like `WH/IN/0001` (`<Warehouse>/<Operation>/<ID>`), atomic within the transaction. */
export async function nextReference(
  warehouseCode: string,
  type: OperationType,
  session: ClientSession,
): Promise<string> {
  const key = `${warehouseCode}/${OPERATION_META[type].prefix}`;
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  ).lean();
  return `${key}/${String(counter?.seq ?? 1).padStart(4, "0")}`;
}
