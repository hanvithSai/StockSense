import { z } from "zod";
import { OPERATION_TYPES, type OperationType } from "@/lib/constants";
import { isoDate, objectId, optionalObjectId, quantity, shortText } from "./common";

export const operationLineSchema = z.object({
  product: objectId("Select a product"),
  quantity,
});

export const operationFieldsSchema = z.object({
  sourceLocation: optionalObjectId,
  destLocation: optionalObjectId,
  contact: shortText(100, "Contact"),
  deliveryAddress: shortText(300, "Delivery address"),
  scheduledDate: isoDate,
  responsible: optionalObjectId,
  notes: shortText(1000, "Notes"),
  lines: z.array(operationLineSchema).max(100, "An operation can have at most 100 products"),
  /** `updatedAt` the client last saw; stale edits are rejected instead of overwriting newer changes. */
  version: z.string().optional(),
});
export type OperationFields = z.infer<typeof operationFieldsSchema>;

/**
 * Type-specific business rules shared by the client form and the API.
 * Returns field errors keyed by path (empty object when valid).
 */
export function operationRules(type: OperationType, data: OperationFields): Record<string, string> {
  const errors: Record<string, string> = {};

  if (type === "receipt") {
    if (!data.contact) errors.contact = "Enter the supplier you receive from";
    if (!data.destLocation) errors.destLocation = "Select the destination location";
  }
  if (type === "delivery") {
    if (!data.contact) errors.contact = "Enter the customer";
    if (!data.sourceLocation) errors.sourceLocation = "Select the source location";
  }
  if (type === "internal") {
    if (!data.sourceLocation) errors.sourceLocation = "Select the source location";
    if (!data.destLocation) errors.destLocation = "Select the destination location";
    if (data.sourceLocation && data.sourceLocation === data.destLocation) {
      errors.destLocation = "Destination must differ from the source";
    }
  }
  if (type === "adjustment" && !data.destLocation) {
    errors.destLocation = "Select the location being counted";
  }

  if (data.lines.length === 0) errors.lines = "Add at least one product";
  const seen = new Set<string>();
  data.lines.forEach((line, index) => {
    if (seen.has(line.product)) {
      errors[`lines.${index}.product`] = "This product is already listed";
    }
    seen.add(line.product);
    if (type !== "adjustment" && !(line.quantity > 0)) {
      errors[`lines.${index}.quantity`] = "Quantity must be greater than 0";
    }
  });

  return errors;
}

/** Full create payload: fields + type, with the shared business rules applied. */
export const operationCreateSchema = operationFieldsSchema
  .extend({ type: z.enum(OPERATION_TYPES, { error: "Select an operation type" }) })
  .superRefine((data, ctx) => {
    for (const [path, message] of Object.entries(operationRules(data.type, data))) {
      ctx.addIssue({ code: "custom", message, path: path.split(".") });
    }
  });
export type OperationCreateInput = z.infer<typeof operationCreateSchema>;

export const pickSchema = z.object({
  lineIds: z.array(objectId()).optional(),
  picked: z.boolean().default(true),
});

export const packSchema = z.object({ packed: z.boolean().default(true) });

export const OPERATION_ACTIONS = [
  "confirm",
  "check-availability",
  "pick",
  "pack",
  "validate",
  "cancel",
  "reset",
] as const;
export type OperationAction = (typeof OPERATION_ACTIONS)[number];
