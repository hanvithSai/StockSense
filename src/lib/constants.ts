export const APP_NAME = "StockSense";

export const ROLES = ["manager", "staff"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  manager: "Inventory Manager",
  staff: "Warehouse Staff",
};

export const OPERATION_TYPES = ["receipt", "delivery", "internal", "adjustment"] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

export const OPERATION_STATUSES = ["draft", "waiting", "ready", "done", "cancelled"] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];
export const OPEN_STATUSES: readonly OperationStatus[] = ["draft", "waiting", "ready"];

export const STATUS_LABELS: Record<OperationStatus, string> = {
  draft: "Draft",
  waiting: "Waiting",
  ready: "Ready",
  done: "Done",
  cancelled: "Cancelled",
};

interface OperationMeta {
  label: string;
  plural: string;
  prefix: string;
  slug: string;
  /** Statuses an operation of this type can move through, in order. */
  flow: readonly OperationStatus[];
}

export const OPERATION_META: Record<OperationType, OperationMeta> = {
  receipt: {
    label: "Receipt",
    plural: "Receipts",
    prefix: "IN",
    slug: "receipts",
    flow: ["draft", "ready", "done"],
  },
  delivery: {
    label: "Delivery Order",
    plural: "Delivery Orders",
    prefix: "OUT",
    slug: "deliveries",
    flow: ["draft", "waiting", "ready", "done"],
  },
  internal: {
    label: "Internal Transfer",
    plural: "Internal Transfers",
    prefix: "INT",
    slug: "transfers",
    flow: ["draft", "waiting", "ready", "done"],
  },
  adjustment: {
    label: "Inventory Adjustment",
    plural: "Inventory Adjustments",
    prefix: "ADJ",
    slug: "adjustments",
    flow: ["draft", "done"],
  },
};

export const SLUG_TO_TYPE: Record<string, OperationType> = {
  receipts: "receipt",
  deliveries: "delivery",
  transfers: "internal",
  adjustments: "adjustment",
};

/** "Backorder of WH/OUT/0125" / "Return of WH/OUT/0120". */
export function originLabel(origin: { reference: string; kind: "backorder" | "return" }) {
  return `${origin.kind === "return" ? "Return of" : "Backorder of"} ${origin.reference}`;
}

export function operationPath(type: OperationType, id?: string) {
  const base = `/operations/${OPERATION_META[type].slug}`;
  return id ? `${base}/${id}` : base;
}

export const LOCATION_TYPES = ["internal", "vendor", "customer", "adjustment"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const UNITS_OF_MEASURE = [
  "Units",
  "kg",
  "g",
  "L",
  "mL",
  "m",
  "cm",
  "Box",
  "Pack",
  "Dozen",
  "Pair",
  "Roll",
] as const;
export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number];

export const STOCK_STATUSES = ["ok", "low", "out"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const AUDIT_ENTITIES = [
  "operation",
  "product",
  "category",
  "warehouse",
  "location",
  "reorderRule",
  "user",
] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];
export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  operation: "Operation",
  product: "Product",
  category: "Category",
  warehouse: "Warehouse",
  location: "Location",
  reorderRule: "Reordering rule",
  user: "User",
};

export const MAX_QUANTITY = 1_000_000_000;
export const LIVE_REFRESH_MS = 15_000;
