import type {
  AuditEntity,
  LocationType,
  OperationStatus,
  OperationType,
  Role,
  StockStatus,
  UnitOfMeasure,
} from "./constants";

/** One entry of the audit trail ("who did what, when"). */
export interface AuditLogDTO {
  id: string;
  entityType: AuditEntity;
  entityId: string | null;
  entityLabel: string;
  action: string;
  message: string;
  link: string | null;
  userId: string | null;
  userName: string;
  createdAt: string;
}

/** Shapes returned by the REST API (shared by server serializers and client components). */

export interface SessionUser {
  id: string;
  loginId: string;
  email: string;
  name: string;
  role: Role;
}

export interface UserDTO extends SessionUser {
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserOptionDTO {
  id: string;
  name: string;
}

export interface WarehouseRef {
  id: string;
  name: string;
  shortCode: string;
}

export interface WarehouseDTO extends WarehouseRef {
  address: string;
  defaultLocationId: string | null;
  locationCount: number;
  productCount: number;
  stockValue: number;
  openOperations: number;
  createdAt: string;
}

export interface LocationDTO {
  id: string;
  name: string;
  shortCode: string;
  fullName: string;
  type: LocationType;
  warehouse: WarehouseRef | null;
  isSystem: boolean;
  isDefault: boolean;
}

/** Location with what it currently holds (settings page). */
export interface LocationStatsDTO extends LocationDTO {
  productCount: number;
  stockValue: number;
}

export interface CategoryDTO {
  id: string;
  name: string;
  description: string;
  productCount: number;
}

export interface StockLocationDTO {
  locationId: string;
  fullName: string;
  warehouseId: string;
  quantity: number;
  reserved: number;
  free: number;
}

export interface ProductRowDTO {
  id: string;
  name: string;
  sku: string;
  uom: UnitOfMeasure;
  costPrice: number;
  description: string;
  category: { id: string; name: string } | null;
  isActive: boolean;
  onHand: number;
  reserved: number;
  free: number;
  /** Quantity on open receipts. */
  incoming: number;
  /** Quantity on open deliveries. */
  outgoing: number;
  /** On hand + incoming - outgoing. */
  forecast: number;
  value: number;
  status: StockStatus;
  minQty: number | null;
  maxQty: number | null;
  locations: StockLocationDTO[];
}

export interface ProductOptionDTO {
  id: string;
  name: string;
  sku: string;
  uom: UnitOfMeasure;
  onHand: number;
}

export interface ReorderRuleDTO {
  id: string;
  product: { id: string; name: string; sku: string; uom: UnitOfMeasure };
  warehouse: WarehouseRef;
  minQty: number;
  maxQty: number;
  onHand: number;
  /** On hand + open receipts - open deliveries in the warehouse. */
  forecast: number;
  status: StockStatus;
  suggestedQty: number;
}

export interface OperationLineDTO {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  uom: string;
  quantity: number;
  picked: boolean;
  systemQty: number | null;
  delta: number | null;
  /** Done deliveries: quantity already brought back by returns. */
  returned: number;
}

export interface LocationRef {
  id: string;
  fullName: string;
  type: LocationType;
}

export interface OperationOrigin {
  id: string;
  reference: string;
  kind: "backorder" | "return";
}

export interface LinkedOperation {
  id: string;
  reference: string;
  status: OperationStatus;
}

export interface OperationDTO {
  id: string;
  reference: string;
  type: OperationType;
  status: OperationStatus;
  warehouse: WarehouseRef;
  sourceLocation: LocationRef;
  destLocation: LocationRef;
  contact: string;
  deliveryAddress: string;
  scheduledDate: string;
  responsible: UserOptionDTO | null;
  notes: string;
  packed: boolean;
  lines: OperationLineDTO[];
  isLate: boolean;
  doneAt: string | null;
  doneByName: string | null;
  /** Set on a backorder (the operation it was split from) or a return (the delivery it brings back). */
  origin: OperationOrigin | null;
  /** Backorders split from this operation. */
  backorders: LinkedOperation[];
  /** Returns created from this delivery. */
  returns: LinkedOperation[];
  createdAt: string;
  updatedAt: string;
}

export interface OperationListItemDTO {
  id: string;
  reference: string;
  type: OperationType;
  status: OperationStatus;
  contact: string;
  sourceName: string;
  destName: string;
  scheduledDate: string;
  responsibleName: string;
  lineCount: number;
  productSummary: string;
  isLate: boolean;
  doneAt: string | null;
  /** Operation this backorder or return comes from. */
  origin: Omit<OperationOrigin, "id"> | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface OperationListDTO extends Paginated<OperationListItemDTO> {
  statusCounts: Partial<Record<OperationStatus, number>>;
}

/** Result of a state transition, with optional follow-up information for the UI. */
export interface OperationActionResult {
  operation: OperationDTO;
  shortages: { productName: string; required: number; available: number; uom: string }[];
  promoted: string[];
  /** Created by a split: the rest of the quantities, to receive or ship later. */
  backorder: { id: string; reference: string } | null;
}

export type MoveDirection = "in" | "out" | "internal";

export interface MoveRowDTO {
  id: string;
  operationId: string;
  reference: string;
  type: OperationType;
  status: OperationStatus;
  date: string;
  contact: string;
  from: string;
  to: string;
  productId: string;
  productName: string;
  sku: string;
  uom: string;
  quantity: number;
  direction: MoveDirection;
}

export interface LedgerRowDTO extends MoveRowDTO {
  change: number;
  balance: number;
}

/** A planned receipt or delivery of one product and the on-hand quantity projected after it. */
export interface ForecastRowDTO {
  operationId: string;
  reference: string;
  type: "receipt" | "delivery";
  status: OperationStatus;
  scheduledDate: string;
  contact: string;
  change: number;
  projected: number;
  isLate: boolean;
}

export interface ProductForecastDTO {
  onHand: number;
  rows: ForecastRowDTO[];
}

export interface OperationTypeStats {
  draft: number;
  waiting: number;
  ready: number;
  done: number;
  cancelled: number;
  open: number;
  late: number;
  upcoming: number;
}

/** Validated operations per day and type. */
export interface ActivityPointDTO {
  date: string;
  receipt: number;
  delivery: number;
  internal: number;
  adjustment: number;
}

export interface DashboardDTO {
  kpis: {
    productsInStock: number;
    totalProducts: number;
    lowStock: number;
    outOfStock: number;
    pendingReceipts: number;
    pendingDeliveries: number;
    scheduledTransfers: number;
    stockValue: number;
  };
  operations: Record<OperationType, OperationTypeStats>;
  activity: ActivityPointDTO[];
  alerts: ProductRowDTO[];
  recentMoves: MoveRowDTO[];
}

export interface ReportDTO {
  days: number;
  summary: {
    stockValue: number;
    valueIn: number;
    valueOut: number;
    operationsDone: number;
    /** Share of operations validated on or before their scheduled date (0-1). */
    onTimeRate: number | null;
    avgDeliveryHours: number | null;
    /** Cost of goods shipped in the period divided by current stock value. */
    turnover: number | null;
    /** Days the current stock lasts at the period's average shipping rate. */
    daysOfCover: number | null;
  };
  movement: { date: string; valueIn: number; valueOut: number; receipts: number; deliveries: number }[];
  valueByCategory: { name: string; value: number }[];
  valueByWarehouse: { name: string; code: string; value: number }[];
  topProducts: { id: string; name: string; sku: string; uom: string; quantity: number; value: number }[];
  statusByType: ({ type: OperationType } & Record<OperationStatus, number>)[];
  slowMovers: { id: string; name: string; sku: string; uom: string; onHand: number; value: number }[];
}

export interface AlertItemDTO {
  id: string;
  name: string;
  sku: string;
  uom: string;
  onHand: number;
  minQty: number | null;
  status: StockStatus;
}

export interface AlertsDTO {
  items: AlertItemDTO[];
  lowCount: number;
  outCount: number;
  waitingCount: number;
  lateCount: number;
}

export interface SearchResultsDTO {
  products: { id: string; name: string; sku: string; onHand: number; uom: string }[];
  operations: {
    id: string;
    reference: string;
    type: OperationType;
    status: OperationStatus;
    contact: string;
  }[];
}

export type AvailabilityDTO = Record<string, { quantity: number; reserved: number; free: number }>;
