import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { ROLES } from "@/lib/constants";

const userSchema = new Schema(
  {
    loginId: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: "staff", required: true },
    isActive: { type: Boolean, default: true },
    /** Incremented on password change/reset to invalidate existing sessions. */
    sessionVersion: { type: Number, default: 0 },
    /** Brute-force protection: consecutive failures and temporary lock. */
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type UserSchema = InferSchemaType<typeof userSchema>;
export type UserRecord = UserSchema & { _id: Types.ObjectId };

export const User: Model<UserSchema> =
  (models.User as Model<UserSchema>) ?? model<UserSchema>("User", userSchema);
