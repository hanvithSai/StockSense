import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { AUDIT_ENTITIES } from "@/lib/constants";

/** Append-only audit trail: every create, change and state transition with its author. */
const auditLogSchema = new Schema(
  {
    entityType: { type: String, enum: AUDIT_ENTITIES, required: true },
    entityId: { type: Schema.Types.ObjectId, default: null },
    /** Human label at the time of the event, e.g. `WH/IN/0001` or `Desk`. */
    entityLabel: { type: String, default: "" },
    action: { type: String, required: true },
    message: { type: String, required: true },
    /** App path of the record (null once deleted). */
    link: { type: String, default: null },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    userName: { type: String, default: "System" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });

export type AuditLogSchema = InferSchemaType<typeof auditLogSchema>;
export type AuditLogRecord = AuditLogSchema & { _id: Types.ObjectId; createdAt: Date };

export const AuditLog: Model<AuditLogSchema> =
  (models.AuditLog as Model<AuditLogSchema>) ?? model<AuditLogSchema>("AuditLog", auditLogSchema);
