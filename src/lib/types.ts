import type {
  LocationType,
  OperationStatus,
  OperationType,
  Role,
  StockStatus,
  UnitOfMeasure,
} from "./constants";

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
}

export interface LocationRef {
  id: string;
  fullName: string;
  type: LocationType;
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
  alerts: ProductRowDTO[];
  recentMoves: MoveRowDTO[];
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
