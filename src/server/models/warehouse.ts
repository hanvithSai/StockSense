import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

const warehouseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    shortCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
    address: { type: String, trim: true, default: "" },
    /** Main stock location, used as the default for receipts and deliveries. */
    defaultLocation: { type: Schema.Types.ObjectId, ref: "Location", default: null },
  },
  { timestamps: true },
);

warehouseSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export type WarehouseSchema = InferSchemaType<typeof warehouseSchema>;
export type WarehouseRecord = WarehouseSchema & { _id: Types.ObjectId };

export const Warehouse: Model<WarehouseSchema> =
  (models.Warehouse as Model<WarehouseSchema>) ??
  model<WarehouseSchema>("Warehouse", warehouseSchema);
