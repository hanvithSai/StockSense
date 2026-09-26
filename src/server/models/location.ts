import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { LOCATION_TYPES } from "@/lib/constants";

/**
 * Internal locations hold stock (racks, rooms, floors). Virtual system locations
 * (vendors, customers, inventory adjustment) are the counterparts of every move,
 * so each movement always has a "from" and a "to", like a double-entry ledger.
 */
const locationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    shortCode: { type: String, required: true, trim: true },
    warehouse: { type: Schema.Types.ObjectId, ref: "Warehouse", default: null },
    type: { type: String, enum: LOCATION_TYPES, default: "internal", required: true },
    /** `<WAREHOUSE>/<SHORTCODE>` for internal locations, e.g. `WH/Stock1`. */
    fullName: { type: String, required: true, trim: true },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

locationSchema.index({ fullName: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
locationSchema.index({ warehouse: 1, type: 1 });

export type LocationSchema = InferSchemaType<typeof locationSchema>;
export type LocationRecord = LocationSchema & { _id: Types.ObjectId };

export const Location: Model<LocationSchema> =
  (models.Location as Model<LocationSchema>) ?? model<LocationSchema>("Location", locationSchema);
