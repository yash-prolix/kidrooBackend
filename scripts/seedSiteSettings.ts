import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import SiteSettings from "../src/models/siteSettings";

/**
 * Seed script to initialize site settings
 */
const seedSiteSettings = async (): Promise<void> => {
  try {
    const dbUrl = process.env.DB_URL;

    if (!dbUrl) {
      throw new Error("DB_URL environment variable is not set");
    }

    // Connect to MongoDB
    console.log("Connecting to database...");
    await mongoose.connect(dbUrl);
    console.log("✓ Connected to MongoDB");

    // Default site settings from screenshot
    const defaultSettings = {
      siteName: "Kidroo Toys",
      tagline: "Where Imagination Comes to Play! 🎈",
      contactEmail: "hello@kidrootoys.com",
      contactPhone: "+91 1800 123 4567",
      logo: "", // Add logo URL if available
      themeColors: {
        primary: "#FF6B35",
        hover: "#E55A25",
        header: "#000000",
        footer: "#031268",
      },
      freeShippingThreshold: 1000,
      freeShippingEnabled: false,
      whatsappConfig: {
        enabled: true,
        sendOrderConfirmed: true,
        sendOrderStatus: true,
        sendPromoBroadcast: true,
        languageCode: "en",
      },
    };

    // Check if site settings already exist
    const existingSettings = await SiteSettings.findOne();

    if (existingSettings) {
      console.log("⚠️  Site settings already exist. Updating with seed data...");
      await SiteSettings.findOneAndUpdate({}, defaultSettings, { new: true });
      console.log("✅ Site settings updated successfully!");
    } else {
      console.log("Creating default site settings...");
      await SiteSettings.create(defaultSettings);
      console.log("✅ Site settings created successfully!");
    }

    console.log("\n📋 Seeded Site Settings:");
    console.log(`   Site Name: ${defaultSettings.siteName}`);
    console.log(`   Colors: Primary: ${defaultSettings.themeColors.primary}, Hover: ${defaultSettings.themeColors.hover}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding site settings:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("✓ Database connection closed");
  }
};

// Run seed
seedSiteSettings();
