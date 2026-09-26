import { Schema, model, models, type Model } from "mongoose";

/** Atomic sequence per `<WAREHOUSE>/<PREFIX>` key, used for operation references. */
interface CounterSchema {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterSchema>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const Counter: Model<CounterSchema> =
  (models.Counter as Model<CounterSchema>) ?? model<CounterSchema>("Counter", counterSchema);
