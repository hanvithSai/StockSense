import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/** Min/max replenishment rule of a product in a warehouse; drives low stock alerts. */
const reorderRuleSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    warehouse: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
    minQty: { type: Number, required: true, min: 0 },
    maxQty: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

reorderRuleSchema.index({ product: 1, warehouse: 1 }, { unique: true });

export type ReorderRuleSchema = InferSchemaType<typeof reorderRuleSchema>;
export type ReorderRuleRecord = ReorderRuleSchema & { _id: Types.ObjectId };

export const ReorderRule: Model<ReorderRuleSchema> =
  (models.ReorderRule as Model<ReorderRuleSchema>) ??
  model<ReorderRuleSchema>("ReorderRule", reorderRuleSchema);
