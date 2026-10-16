import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

// ── Address sub-document ────────────────────────────────────────
export interface IAddress {
  label: "home" | "work" | "other";
  fullName: string;
  phone: string;
  houseNo: string;
  street: string;
  landmark?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

const addressSchema = new Schema<IAddress>(
  {
    label: {
      type: String,
      enum: ["home", "work", "other"],
      default: "home",
    },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    houseNo: { type: String, trim: true },
    street: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    zipCode: { type: String, required: true, trim: true },
    country: { type: String, default: "India", trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

// ── Customer Interface ──────────────────────────────────────────
export interface ICustomer extends Document {
  firstName: string;
  lastName: string;
  email?: string;
  mobile: string;
  alternatePhone?: string;
  password: string;
  avatar?: string;
  addresses: IAddress[];
  wishlist: mongoose.Types.ObjectId[];
  // OTP fields
  otp?: string;
  otpExpiry?: Date;
  isVerified: boolean;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ── Customer Schema ─────────────────────────────────────────────
const customerSchema = new Schema<ICustomer>(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [2, "Last name must be at least 2 characters"],
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // Allow null/undefined while still being unique when provided
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Invalid email format",
      ],
    },
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Invalid Indian mobile number"],
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    avatar: {
      type: String,
    },
    addresses: {
      type: [addressSchema],
      validate: {
        validator: function (v: IAddress[]) {
          return v.length <= 5;
        },
        message: "You can add a maximum of 5 addresses",
      },
    },
    wishlist: [
      {
        type: Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    // OTP for mobile verification
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

// ── Pre-save: hash password ─────────────────────────────────────
customerSchema.pre<ICustomer>("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ── Method: compare password ────────────────────────────────────
customerSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password || !candidatePassword) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Override toJSON ─────────────────────────────────────────────
customerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpiry;
  return obj;
};

const Customer = mongoose.model<ICustomer>("Customer", customerSchema);

export default Customer;