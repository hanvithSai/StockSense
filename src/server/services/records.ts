import type { Types } from "mongoose";
import type { LocationType, OperationStatus, OperationType, UnitOfMeasure } from "@/lib/constants";

/** Explicit shapes of lean (plain object) query results used by the services. */

export interface OperationLineLean {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  productName: string;
  sku: string;
  uom: string;
  category: Types.ObjectId | null;
  quantity: number;
  picked: boolean;
  systemQty: number | null;
  delta: number | null;
}

export interface OperationLean {
  _id: Types.ObjectId;
  reference: string;
  type: OperationType;
  status: OperationStatus;
  warehouse: Types.ObjectId;
  sourceLocation: Types.ObjectId;
  destLocation: Types.ObjectId;
  sourceName: string;
  destName: string;
  contact: string;
  deliveryAddress: string;
  scheduledDate: string;
  responsible: Types.ObjectId | null;
  responsibleName: string;
  notes: string;
  packed: boolean;
  lines: OperationLineLean[];
  doneAt: Date | null;
  doneByName: string;
  backorderOf?: Types.ObjectId | null;
  origin?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PopulatedOperationLean
  extends Omit<OperationLean, "warehouse" | "sourceLocation" | "destLocation"> {
  warehouse: { _id: Types.ObjectId; name: string; shortCode: string } | null;
  sourceLocation: { _id: Types.ObjectId; fullName: string; type: LocationType } | null;
  destLocation: { _id: Types.ObjectId; fullName: string; type: LocationType } | null;
}

/** One unwound operation line, as produced by `$unwind: "$lines"`. */
export interface UnwoundLineLean extends Omit<OperationLean, "lines"> {
  lines: OperationLineLean;
}

export interface ProductLean {
  _id: Types.ObjectId;
  name: string;
  sku: string;
  uom: UnitOfMeasure;
  costPrice: number;
  description: string;
  isActive: boolean;
  category: { _id: Types.ObjectId; name: string } | null;
}

export interface QuantLean {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  warehouse: Types.ObjectId;
  quantity: number;
  reservedQuantity: number;
  location: { _id: Types.ObjectId; fullName: string } | null;
}
