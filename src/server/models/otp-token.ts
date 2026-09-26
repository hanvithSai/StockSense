import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const otpTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** HMAC-SHA256 of the code; the plain code is never stored. */
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
    /** TTL index: MongoDB removes the document once it expires. */
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export type OtpTokenSchema = InferSchemaType<typeof otpTokenSchema>;

export const OtpToken: Model<OtpTokenSchema> =
  (models.OtpToken as Model<OtpTokenSchema>) ?? model<OtpTokenSchema>("OtpToken", otpTokenSchema);
