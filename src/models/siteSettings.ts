import mongoose from "mongoose";

export interface ISiteSettings {
  siteName: string;
  tagline: string;
  contactEmail: string;
  contactPhone: string;
  logo: string;
  themeColors: {
    primary: string;
    hover: string;
    header: string;
    footer: string;
  };
  paymentMethods: {
    onlinePayment: boolean;
    cashOnDelivery: boolean;
  };
  razorpayConfig: {
    keyId: string;
    keySecret: string;
  };
  freeShippingThreshold: number;
  freeShippingEnabled: boolean;
  whatsappConfig: {
    enabled: boolean;              // Master ON/OFF toggle for all WhatsApp notifications
    sendOrderConfirmed: boolean;   // Toggle: send when order is placed/confirmed
    sendOrderStatus: boolean;      // Toggle: send on order status updates
    sendPromoBroadcast: boolean;   // Toggle: send promo broadcasts
    languageCode: string;          // Default language code (e.g. "en")
  };
}

const siteSettingsSchema = new mongoose.Schema<ISiteSettings>(
  {
    siteName: {
      type: String,
      required: true,
      default: "Kidroo Toys",
    },
    tagline: {
      type: String,
      required: true,
      default: "Where Imagination Comes to Play! 🎈",
    },
    contactEmail: {
      type: String,
      required: true,
      default: "hello@kidrootoys.com",
    },
    contactPhone: {
      type: String,
      required: true,
      default: "+91 1800 123 4567",
    },
    logo: {
      type: String,
      required: false,
      default: "",
    },
    themeColors: {
      primary: {
        type: String,
        required: true,
        default: "#FF6B35",
      },
      hover: {
        type: String,
        required: true,
        default: "#E55A25",
      },
      header: {
        type: String,
        required: true,
        default: "#000000",
      },
      footer: {
        type: String,
        required: true,
        default: "#031268",
      },
    },
    paymentMethods: {
      onlinePayment: {
        type: Boolean,
        default: true,
      },
      cashOnDelivery: {
        type: Boolean,
        default: false,
      },
    },
    razorpayConfig: {
      keyId: {
        type: String,
        default: "",
      },
      keySecret: {
        type: String,
        default: "",
        select: false,  // Never return keySecret in queries by default
      },
    },
    freeShippingThreshold: {
      type: Number,
      default: 1000,
    },
    freeShippingEnabled: {
      type: Boolean,
      default: false,
    },
    whatsappConfig: {
      // Master toggle — when false, NO WhatsApp messages are sent at all
      enabled: {
        type: Boolean,
        default: true,
      },
      // Individual event toggles
      sendOrderConfirmed: {
        type: Boolean,
        default: true,
      },
      sendOrderStatus: {
        type: Boolean,
        default: true,
      },
      sendPromoBroadcast: {
        type: Boolean,
        default: true,
      },
      // Default language for messages (individual templates can override this)
      languageCode: {
        type: String,
        default: "en",
      },
    },
  },
  { timestamps: true },
);

// Ensure only one settings document exists
siteSettingsSchema.set("toJSON", { virtuals: true });
siteSettingsSchema.set("toObject", { virtuals: true });

const SiteSettings = mongoose.model<ISiteSettings>("SiteSettings", siteSettingsSchema);

export default SiteSettings;
