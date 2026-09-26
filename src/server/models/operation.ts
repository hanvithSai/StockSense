import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import { OPERATION_STATUSES, OPERATION_TYPES } from "@/lib/constants";

const operationLineSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  productName: { type: String, required: true },
  sku: { type: String, required: true },
  uom: { type: String, required: true },
  category: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  /** Demand for receipts/deliveries/transfers; counted quantity for adjustments. */
  quantity: { type: Number, required: true, min: 0 },
  picked: { type: Boolean, default: false },
  /** Adjustments only: on-hand quantity before the count was applied. */
  systemQty: { type: Number, default: null },
  /** Adjustments only: counted - system (positive = stock in). */
  delta: { type: Number, default: null },
});

/**
 * A stock operation (receipt, delivery, internal transfer or adjustment).
 * Each line is one product move from `sourceLocation` to `destLocation`;
 * done operations are immutable and form the stock ledger.
 */
const operationSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    type: { type: String, enum: OPERATION_TYPES, required: true },
    status: { type: String, enum: OPERATION_STATUSES, default: "draft", required: true },
    warehouse: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    sourceLocation: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    destLocation: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    sourceName: { type: String, required: true },
    destName: { type: String, required: true },
    contact: { type: String, trim: true, default: "" },
    deliveryAddress: { type: String, trim: true, default: "" },
    /** Local calendar date `YYYY-MM-DD` (timezone independent). */
    scheduledDate: { type: String, required: true },
    responsible: { type: Schema.Types.ObjectId, ref: "User", default: null },
    responsibleName: { type: String, default: "" },
    notes: { type: String, trim: true, default: "" },
    packed: { type: Boolean, default: false },
    lines: { type: [operationLineSchema], default: [] },
    doneAt: { type: Date, default: null },
    doneBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    doneByName: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

operationSchema.index({ type: 1, status: 1, scheduledDate: 1 });
operationSchema.index({ sourceLocation: 1, status: 1 });
operationSchema.index({ destLocation: 1, status: 1 });
operationSchema.index({ warehouse: 1, type: 1 });
operationSchema.index({ "lines.product": 1, doneAt: -1 });
operationSchema.index({ doneAt: -1 });

export type OperationSchema = InferSchemaType<typeof operationSchema>;
export type OperationRecord = OperationSchema & { _id: Types.ObjectId };
export type OperationDocument = HydratedDocument<OperationSchema>;

export const Operation: Model<OperationSchema> =
  (models.Operation as Model<OperationSchema>) ??
  model<OperationSchema>("Operation", operationSchema);
