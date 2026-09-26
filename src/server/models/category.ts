import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

categorySchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export type CategorySchema = InferSchemaType<typeof categorySchema>;
export type CategoryRecord = CategorySchema & { _id: Types.ObjectId };

export const Category: Model<CategorySchema> =
  (models.Category as Model<CategorySchema>) ?? model<CategorySchema>("Category", categorySchema);
