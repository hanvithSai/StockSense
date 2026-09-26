import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { UNITS_OF_MEASURE } from "@/lib/constants";

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true, unique: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    uom: { type: String, enum: UNITS_OF_MEASURE, required: true, default: "Units" },
    /** Per unit cost in INR. */
    costPrice: { type: Number, min: 0, default: 0 },
    description: { type: String, trim: true, default: "" },
    /** Archived products keep their history but cannot be used in new operations. */
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ name: 1 });
productSchema.index({ category: 1, isActive: 1 });

export type ProductSchema = InferSchemaType<typeof productSchema>;
export type ProductRecord = ProductSchema & { _id: Types.ObjectId };

export const Product: Model<ProductSchema> =
  (models.Product as Model<ProductSchema>) ?? model<ProductSchema>("Product", productSchema);
