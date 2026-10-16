import mongoose, { Document, Schema } from "mongoose";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
  productName: string;
  skuCode?: string;
  image?: string;
  weight?: number;
  length?: number;
  breadth?: number;
  width?: number;
  height?: number;
}

export interface IShippingAddress {
  fullName: string;
  phone: string;
  houseNo?: string;
  street: string;
  landmark?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface IOrder extends Document {
  orderId: string; // Friendly customer-facing Order ID
  customer: mongoose.Types.ObjectId;
  items: IOrderItem[];
  
  // Financial metrics
  totalItemsPrice: number;
  shippingCharges: number;
  couponCode?: string;
  couponDiscount: number;
  netAmount: number;
  
  // Payment info
  paymentMethod: "online" | "cod";
  paymentStatus: "Pending" | "Paid" | "Failed";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;

  // Shipping & Tracking Status
  status: "Pending" | "Confirmed" | "Shipped" | "Delivered" | "Cancelled";
  
  shippingAddress: IShippingAddress;
  billingAddress?: IShippingAddress;
  
  // Shiprocket fulfillment metadata
  shiprocketOrderId?: string;
  shiprocketShipmentId?: string;
  shiprocketAwbNumber?: string;
  shiprocketCourierCompany?: string;
  shiprocketCourierRating?: string;
  shiprocketStatus?: string;
  shiprocketLabelUrl?: string;
  shiprocketInvoiceUrl?: string;
  shiprocketManifestUrl?: string;
  // WhatsApp Notification metadata
  whatsappNotification?: IOrderWhatsAppNotification;

  createdAt: Date;
  updatedAt: Date;
}

export interface IWhatsAppHistoryItem {
  eventType: string;
  templateName?: string;
  recipientPhone: string;
  status: "Sent" | "Failed";
  messageId?: string;
  errorReason?: string;
  sentAt: Date;
}

export interface IOrderWhatsAppNotification {
  sent: boolean;
  status: "Sent" | "Failed" | "Not Sent";
  lastSentAt?: Date;
  lastTemplate?: string;
  lastError?: string;
  history: IWhatsAppHistoryItem[];
}

const orderItemSchema = new Schema<IOrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant" },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  productName: { type: String, required: true },
  skuCode: { type: String },
  image: { type: String },
  weight: { type: Number, default: 0.5 },
  length: { type: Number, default: 15 },
  breadth: { type: Number, default: 10 },
  width: { type: Number, default: 10 },
  height: { type: Number, default: 10 },
});

const shippingAddressSchema = new Schema<IShippingAddress>({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  houseNo: { type: String },
  street: { type: String, required: true },
  landmark: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, default: "India" },
});

const orderWhatsAppHistorySchema = new Schema(
  {
    eventType: { type: String, required: true },
    templateName: { type: String },
    recipientPhone: { type: String, required: true },
    status: { type: String, enum: ["Sent", "Failed"], required: true },
    messageId: { type: String },
    errorReason: { type: String },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderWhatsAppSchema = new Schema(
  {
    sent: { type: Boolean, default: false },
    status: { type: String, enum: ["Sent", "Failed", "Not Sent"], default: "Not Sent" },
    lastSentAt: { type: Date },
    lastTemplate: { type: String },
    lastError: { type: String },
    history: { type: [orderWhatsAppHistorySchema], default: [] },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    items: [orderItemSchema],
    totalItemsPrice: { type: Number, required: true, min: 0 },
    shippingCharges: { type: Number, required: true, default: 0 },
    couponCode: { type: String },
    couponDiscount: { type: Number, required: true, default: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["online", "cod"], default: "online" },
    paymentStatus: { type: String, enum: ["Pending", "Paid", "Failed"], default: "Pending" },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    status: { 
      type: String, 
      enum: ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"], 
      default: "Pending",
      index: true 
    },
    shippingAddress: { type: shippingAddressSchema, required: true },
    billingAddress: { type: shippingAddressSchema },
    shiprocketOrderId: { type: String },
    shiprocketShipmentId: { type: String },
    shiprocketAwbNumber: { type: String },
    shiprocketCourierCompany: { type: String },
    shiprocketCourierRating: { type: String },
    shiprocketStatus: { type: String },
    shiprocketLabelUrl: { type: String },
    shiprocketInvoiceUrl: { type: String },
    shiprocketManifestUrl: { type: String },
    whatsappNotification: {
      type: orderWhatsAppSchema,
      default: () => ({
        sent: false,
        status: "Not Sent",
        history: [],
      }),
    },
  },
  { timestamps: true }
);

// Indexes for common queries
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model<IOrder>("Order", orderSchema);

export default Order;
