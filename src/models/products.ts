import mongoose from "mongoose";

export interface IProduct {
  productName: string;
  slug: string;
  productCode: string;
  description: string;
  price: number;
  originalPrice: number;
  discountPercentage?: number;
  stock: number;
  categories?: mongoose.Schema.Types.ObjectId[];
  image: string;
  images: string[];
  ratings?: number;
  numReviews?: number;
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  ageRange?: string[];
  tags: string[];
  isActive: boolean;
  youtubeUrl?: string;
  youtubeUrl2?: string;
  position?: number;
  weight: number;
  length: number;
  breadth: number;
  width: number;
  height: number;
  skuCode?: string;
  skills?: mongoose.Schema.Types.ObjectId[];
  hasWarranty?: boolean;
  warrantyPeriod?: number;
  warrantyType?: 'manufacturer' | 'seller';
  hasGuarantee?: boolean;
  guaranteePeriod?: number;
  guaranteeTerms?: string;
  seoKeywords?: string[];
  seoTitle?: string;
  seoDescription?: string;
  specifications?: { key: string; value: string }[];
  hasVariants?: boolean;
  variants?: mongoose.Schema.Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

const productSchema = new mongoose.Schema<IProduct>(
  {
    productName: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    productCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    originalPrice: {
      type: Number,
      required: true,
    },
    discountPercentage: {
      type: Number,
      required: false,
      default: 0,
    },
    stock: {
      type: Number,
      required: true,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    image: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      required: true,
    },
    ratings: {
      type: Number,
      required: false,
      default: 0,
    },
    numReviews: {
      type: Number,
      required: false,
      default: 0,
    },
    featured: {
      type: Boolean,
      required: false,
      default: false,
    },
    newArrival: {
      type: Boolean,
      required: false,
      default: false,
    },
    bestSeller: {
      type: Boolean,
      required: false,
      default: false,
    },
    ageRange: {
      type: [String],
      enum: ['0-2', '2-4', '4-6', '6-8', '8+'],
      default: [],
    },
    tags: {
      type: [String],
      required: true,
    },
    isActive: {
      type: Boolean,
      required: true,
    },
    youtubeUrl: {
      type: String,
      default: '',
    },
    youtubeUrl2: {
      type: String,
      default: '',
    },

    position: {
      type: Number,
      default: 0,
    },
    weight: {
      type: Number,
      required: true,
      default: 0.5,
      min: 0.01,
    },
    length: {
      type: Number,
      default: 15,
      min: 0.1,
    },
    breadth: {
      type: Number,
      default: 10,
      min: 0.1,
    },
    width: {
      type: Number,
      default: 10,
      min: 0.1,
    },
    height: {
      type: Number,
      default: 10,
      min: 0.1,
    },
    skuCode: {
      type: String,
      default: '',
      trim: true,
    },
    skills: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Skill",
      },
    ],
    hasWarranty: {
      type: Boolean,
      default: false,
    },
    warrantyPeriod: {
      type: Number,
    },
    warrantyType: {
      type: String,
      enum: ["manufacturer", "seller"],
    },
    hasGuarantee: {
      type: Boolean,
      default: false,
    },
    guaranteePeriod: {
      type: Number,
    },
    guaranteeTerms: {
      type: String,
    },
    seoKeywords: {
      type: [String],
      default: [],
    },
    seoTitle: {
      type: String,
      default: '',
    },
    seoDescription: {
      type: String,
      default: '',
    },
    specifications: {
      type: [{ key: String, value: String }],
      default: [],
    },
  },
  { timestamps: true },
);

// Ensure virtuals are included when converting document to JSON
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

const Product = mongoose.model<IProduct>("Product", productSchema);

export default Product;
