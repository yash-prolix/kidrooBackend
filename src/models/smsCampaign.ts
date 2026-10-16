import mongoose, { Schema, Document } from "mongoose";

// ── Campaign recipient result sub-doc ──────────────────────────
export interface ICampaignRecipient {
  customerId?: mongoose.Types.ObjectId;
  mobile: string;
  name: string;
  status: "draft" | "sent" | "delivered" | "failed";
  errorReason?: string;
  deliveredAt?: Date;
}

// ── Main interface ──────────────────────────────────────────────
export interface ISmsCampaign extends Document {
  name: string;
  message: string;
  channel: "whatsapp";   // Always WhatsApp for now; extend for SMS later
  targetGroup: "all" | "repeat" | "high_value" | "new" | "at_risk" | "custom";
  targetLabel: string;
  targetIds: mongoose.Types.ObjectId[];
  recipients: ICampaignRecipient[];
  status: "draft" | "sent" | "scheduled";
  templateKey?: string;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ──────────────────────────────────────────────────────
const smsCampaignSchema = new Schema<ISmsCampaign>(
  {
    name: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 1024 },
    channel: { type: String, enum: ["whatsapp"], default: "whatsapp" },
    templateKey: { type: String, default: "promoBlast" },
    targetGroup: {
      type: String,
      enum: ["all", "repeat", "high_value", "new", "at_risk", "custom"],
      default: "all",
    },
    targetLabel: { type: String, default: "All Customers" },
    targetIds: [{ type: Schema.Types.ObjectId, ref: "Customer" }],
    recipients: [
      {
        customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
        mobile: { type: String, required: true },
        name: { type: String, default: "Customer" },
        status: {
          type: String,
          enum: ["draft", "sent", "delivered", "failed"],
          default: "draft",
        },
        errorReason: { type: String, default: "" },
        deliveredAt: { type: Date },
      },
    ],
    status: {
      type: String,
      enum: ["draft", "sent", "scheduled"],
      default: "draft",
    },
    sentCount:      { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    failedCount:    { type: Number, default: 0 },
    sentAt:         { type: Date },
  },
  { timestamps: true }
);

smsCampaignSchema.index({ createdAt: -1 });
smsCampaignSchema.index({ status: 1 });

const SmsCampaign = mongoose.model<ISmsCampaign>("SmsCampaign", smsCampaignSchema);
export default SmsCampaign;
