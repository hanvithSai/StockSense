import { api, qs } from "./api-client";
import type { OperationStatus, OperationType } from "./constants";
import { todayISO } from "./format";
import type { OperationActionResult } from "./types";
import type { OperationAction } from "./validation/operations";

/**
 * Engine actions needed to move an operation from one status column to another
 * (used by kanban drag and drop). Returns null when the move is not allowed.
 */
export function transitionActions(type: OperationType, from: OperationStatus, to: OperationStatus): OperationAction[] | null {
  if (from === to || from === "done") return null;
  if (to === "cancelled") return ["cancel"];
  if (to === "draft") return ["reset"];
  if (to === "waiting" || to === "ready") {
    if (type === "adjustment" || from === "cancelled") return null;
    if (from === "draft") return ["confirm"];
    if (from === "waiting" && to === "ready") return ["check-availability"];
    return null;
  }
  // to === "done"
  if (from === "cancelled") return null;
  if (type === "adjustment") return from === "draft" ? ["validate"] : null;
  const finish: OperationAction[] = type === "delivery" ? ["pick", "pack", "validate"] : ["validate"];
  if (from === "draft") return ["confirm", ...finish];
  if (from === "ready") return finish;
  return null;
}

const ACTION_BODY: Partial<Record<OperationAction, unknown>> = { pick: { picked: true }, pack: { packed: true } };

/**
 * Runs the engine actions of a status change one after another (kanban drops, bulk actions).
 * Throws a readable error when stock is short and the operation ends up waiting, unless waiting is acceptable.
 */
export async function runTransition(
  id: string,
  actions: OperationAction[],
  { allowWaiting = false }: { allowWaiting?: boolean } = {},
): Promise<OperationActionResult> {
  let result: OperationActionResult | null = null;
  for (const action of actions) {
    result = await api<OperationActionResult>(`/api/operations/${id}/${action}${qs({ today: todayISO() })}`, {
      method: "POST",
      body: ACTION_BODY[action] ?? {},
    });
    if (result.operation.status === "waiting" && !allowWaiting) {
      const short = result.shortages.map((shortage) => `${shortage.productName}: ${shortage.available} free`).join(", ");
      throw new Error(`waiting for stock${short ? ` (${short})` : ""}`);
    }
  }
  if (!result) throw new Error("Nothing to run");
  return result;
}
