import { z } from "zod";
import { UNITS_OF_MEASURE } from "@/lib/constants";
import { money, objectId, optionalObjectId, quantity, shortText } from "./common";

export const warehouseSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name is too long"),
  shortCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,5}$/, "Use 2-5 letters or digits (e.g. WH)"),
  address: shortText(200, "Address"),
});
export type WarehouseInput = z.infer<typeof warehouseSchema>;

export const locationSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name is too long"),
  shortCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,12}$/, "Use 1-12 letters, digits, - or _ (e.g. Stock1)"),
  warehouse: objectId("Select a warehouse"),
});
export type LocationInput = z.infer<typeof locationSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(40, "Name is too long"),
  description: shortText(200, "Description"),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const productSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9_-]{1,19}$/, "Use 2-20 letters, digits, - or _ (e.g. DESK001)"),
  category: objectId("Select a category"),
  uom: z.enum(UNITS_OF_MEASURE, { error: "Select a unit of measure" }),
  costPrice: money,
  description: shortText(500, "Description"),
});

export const productCreateSchema = productSchema
  .extend({
    initialQuantity: quantity.optional(),
    initialLocation: optionalObjectId,
  })
  .refine((data) => !data.initialQuantity || Boolean(data.initialLocation), {
    error: "Select where the initial stock is stored",
    path: ["initialLocation"],
  });
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductInput = z.infer<typeof productSchema>;

export const reorderRuleSchema = z
  .object({
    product: objectId("Select a product"),
    warehouse: objectId("Select a warehouse"),
    minQty: quantity,
    maxQty: quantity,
  })
  .refine((data) => data.maxQty >= data.minQty, {
    error: "Maximum must be greater than or equal to minimum",
    path: ["maxQty"],
  });
export type ReorderRuleInput = z.infer<typeof reorderRuleSchema>;

export const stockUpdateSchema = z.object({
  product: objectId("Select a product"),
  location: objectId("Select a location"),
  countedQty: quantity,
  note: shortText(200, "Note"),
});
export type StockUpdateInput = z.infer<typeof stockUpdateSchema>;
