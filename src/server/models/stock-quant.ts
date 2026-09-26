import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/**
 * Quantity of a product at an internal location.
 * `reservedQuantity` is held by confirmed deliveries/transfers; free to use = quantity - reserved.
 * Only the inventory engine mutates quants, always inside a transaction.
 */
const stockQuantSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    location: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    warehouse: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    quantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

stockQuantSchema.index({ product: 1, location: 1 }, { unique: true });
stockQuantSchema.index({ warehouse: 1, product: 1 });
stockQuantSchema.index({ location: 1 });

export type StockQuantSchema = InferSchemaType<typeof stockQuantSchema>;
export type StockQuantRecord = StockQuantSchema & { _id: Types.ObjectId };

export const StockQuant: Model<StockQuantSchema> =
  (models.StockQuant as Model<StockQuantSchema>) ??
  model<StockQuantSchema>("StockQuant", stockQuantSchema);
