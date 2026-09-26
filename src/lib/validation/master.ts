import { z } from "zod";
import { UNITS_OF_MEASURE, type UnitOfMeasure } from "@/lib/constants";
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

const UOM_SYNONYMS: Record<string, UnitOfMeasure> = {
  unit: "Units",
  units: "Units",
  pc: "Units",
  pcs: "Units",
  nos: "Units",
  kgs: "kg",
  kilogram: "kg",
  gram: "g",
  grams: "g",
  l: "L",
  ltr: "L",
  litre: "L",
  liter: "L",
  ml: "mL",
  meter: "m",
  metre: "m",
  meters: "m",
  boxes: "Box",
  packs: "Pack",
  pairs: "Pair",
  rolls: "Roll",
};

/** Maps free-text units from spreadsheets ("pcs", "KG", "Litre") to a supported unit of measure. */
export function normalizeUom(value: string): UnitOfMeasure | null {
  const text = value.trim();
  const exact = UNITS_OF_MEASURE.find((unit) => unit.toLowerCase() === text.toLowerCase());
  return exact ?? UOM_SYNONYMS[text.toLowerCase()] ?? null;
}

/** One spreadsheet row of a product import (category and location by name). */
export const productImportRowSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9_-]{1,19}$/, "SKU must be 2-20 letters, digits, - or _"),
  category: z.string().trim().min(1, "Category is required").max(40, "Category is too long"),
  uom: z
    .string()
    .trim()
    .refine((value) => normalizeUom(value) !== null, "Unknown unit of measure"),
  costPrice: money,
  description: shortText(500, "Description"),
  initialQuantity: quantity.optional(),
  location: shortText(60, "Location").optional(),
});
export type ProductImportRow = z.infer<typeof productImportRowSchema>;

export const productImportSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "The file has no rows").max(1000, "Import at most 1000 rows at a time"),
  updateExisting: z.boolean().default(false),
  createCategories: z.boolean().default(true),
});

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
