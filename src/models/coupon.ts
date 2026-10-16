import mongoose from "mongoose";

interface ICouponUsage {
  customerId: mongoose.Schema.Types.ObjectId;
  usedAt: Date;
}

interface ICoupon extends mongoose.Document {
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  minQuantity?: number;
  applicableProducts: mongoose.Schema.Types.ObjectId[];
  validFrom: Date;
  validTo: Date;
  usageLimit: number;
  usedCount: number;
  perUserLimit: number;
  usedBy: ICouponUsage[];
  isActive: boolean;
  visibility: "public" | "private";
  createdAt?: Date;
  updatedAt?: Date;
}

const couponSchema = new mongoose.Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    maxDiscount: {
      type: Number,
      default: null,
    },
    minQuantity: {
      type: Number,
      default: 0,
    },
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      required: true,
      default: 100,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1,
    },
    usedBy: [
      {
        customerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Customer",
          required: true,
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
  },
  { timestamps: true }
);

// Indexes
couponSchema.index({ visibility: 1, isActive: 1, validTo: 1 });

const Coupon = mongoose.model<ICoupon>("Coupon", couponSchema);

export default Coupon;
