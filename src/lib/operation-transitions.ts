import type { OperationStatus, OperationType } from "./constants";
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
