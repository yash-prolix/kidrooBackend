import mongoose from "mongoose";
import * as dotenv from "dotenv";
import Product from "../src/models/products";
import ProductVariant from "../src/models/variants";

dotenv.config();

const DB_URL = process.env.DB_URL;

if (!DB_URL) {
  console.error("Please define the DB_URL environment variable inside .env");
  process.exit(1);
}

const seedData = async () => {
  try {
    console.log("Connecting to Database...");
    await mongoose.connect(DB_URL);
    console.log("Connected Successfully.");

    console.log("Clearing existing products and variants...");
    await Product.deleteMany({});
    await ProductVariant.deleteMany({});
    console.log("Cleared.");

    const defaultCategory = new mongoose.Types.ObjectId() as any; // Will work as dummy or point to an existing if replaced

    // --- Product 1: Wooden Block Set ---
    const woodenBlockProduct = await Product.create({
      productName: "Classic Wooden Block Set",
      slug: "classic-wooden-block-set",
      productCode: "WBS-101",
      description: "A 50-piece set of high-quality wooden blocks helping toddlers develop motor skills.",
      price: 29.99,
      originalPrice: 34.99,
      discountPercentage: 14,
      stock: 0, // Handled by variants
      categories: [defaultCategory],
      image: "https://res.cloudinary.com/demo/image/upload/v1612456789/wooden_blocks.jpg",
      images: ["https://res.cloudinary.com/demo/image/upload/v1612456789/wooden_blocks.jpg"],
      ratings: 4.8,
      numReviews: 45,
      featured: true,
      newArrival: false,
      bestSeller: true,
      ageRange: ["2-4"],
      tags: ["wooden", "blocks", "toddler", "educational"],
      isActive: true,
      hasVariants: true,
      weight: 1.2,
      length: 20,
      breadth: 20,
      width: 20,
      height: 15
    });

    const woodenBlockVariants = await ProductVariant.insertMany([
      {
        product: woodenBlockProduct!._id,
        sku: "WBS-NATURAL",
        barcode: "100000000001",
        attributes: { Color: "Natural Wood", Edition: "Standard" },
        price: 29.99,
        originalPrice: 34.99,
        stock: 50,
        lowStockAlert: 10,
        images: ["https://res.cloudinary.com/demo/image/upload/v1612456789/wooden_blocks.jpg"],
        weight: 1200,
        dimensions: { length: 20, width: 20, height: 15 },
        status: "active",
        isDefault: true
      },
      {
        product: woodenBlockProduct!._id,
        sku: "WBS-PAINTED",
        barcode: "100000000002",
        attributes: { Color: "Multicolor", Edition: "Standard" },
        price: 34.99,
        originalPrice: 40.00,
        stock: 30,
        lowStockAlert: 5,
        images: ["https://res.cloudinary.com/demo/image/upload/v1612456790/wooden_blocks_color.jpg"],
        weight: 1250,
        dimensions: { length: 20, width: 20, height: 15 },
        status: "active",
        isDefault: false
      }
    ]);

    woodenBlockProduct!.variants = woodenBlockVariants.map(v => v._id as unknown as mongoose.Schema.Types.ObjectId);
    await woodenBlockProduct!.save();

    // --- Product 2: RC Car ---
    const rcCarProduct = await Product.create({
      productName: "High Speed RC Car",
      slug: "high-speed-rc-car",
      productCode: "RCC-102",
      description: "Fast remote control car with off-road capabilities and rechargeable battery.",
      price: 49.99,
      originalPrice: 69.99,
      discountPercentage: 28,
      stock: 0, 
      categories: [defaultCategory],
      image: "https://res.cloudinary.com/demo/image/upload/v1612456791/rc_car.jpg",
      images: ["https://res.cloudinary.com/demo/image/upload/v1612456791/rc_car.jpg"],
      ratings: 4.5,
      numReviews: 120,
      featured: true,
      newArrival: true,
      bestSeller: false,
      ageRange: ["8+"],
      tags: ["rc", "car", "remote control", "outdoor"],
      isActive: true,
      hasVariants: true,
      weight: 0.8,
      length: 30,
      breadth: 15,
      width: 15,
      height: 12
    });

    const rcCarVariants = await ProductVariant.insertMany([
      {
        product: rcCarProduct!._id,
        sku: "RCC-RED",
        barcode: "200000000001",
        attributes: { Color: "Red", Trim: "Sport" },
        price: 49.99,
        originalPrice: 69.99,
        stock: 25,
        lowStockAlert: 5,
        images: ["https://res.cloudinary.com/demo/image/upload/v1612456791/rc_car_red.jpg"],
        weight: 800,
        dimensions: { length: 30, width: 15, height: 12 },
        status: "active",
        isDefault: true
      },
      {
        product: rcCarProduct!._id,
        sku: "RCC-BLUE",
        barcode: "200000000002",
        attributes: { Color: "Blue", Trim: "Sport" },
        price: 49.99,
        originalPrice: 69.99,
        stock: 0,
        lowStockAlert: 5,
        images: ["https://res.cloudinary.com/demo/image/upload/v1612456792/rc_car_blue.jpg"],
        weight: 800,
        dimensions: { length: 30, width: 15, height: 12 },
        status: "out_of_stock",
        isDefault: false
      },
      {
        product: rcCarProduct!._id,
        sku: "RCC-PRO",
        barcode: "200000000003",
        attributes: { Color: "Carbon Fiber", Trim: "Pro Edition" },
        price: 79.99,
        originalPrice: 99.99,
        stock: 10,
        lowStockAlert: 2,
        images: ["https://res.cloudinary.com/demo/image/upload/v1612456793/rc_car_carbon.jpg"],
        weight: 850,
        dimensions: { length: 32, width: 16, height: 12 },
        status: "active",
        isDefault: false
      }
    ]);

    rcCarProduct!.variants = rcCarVariants.map(v => v._id as unknown as mongoose.Schema.Types.ObjectId);
    await rcCarProduct!.save();

    console.log("Successfully seeded database with products and variants.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedData();
