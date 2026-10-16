import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { siteSettingsService } from "../services/siteSettingsService";
import { sendSuccessResponse, sendErrorResponse } from "../utils/apiResponse";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId, // MED-2: centralized helper, removed local duplicate
} from "../utils/uploadToCloudinary";
import fs from "fs";

/**
 * Get Site Settings
 * GET /api/v1/site-settings
 * Note: razorpayConfig.keySecret is excluded via select:false in schema
 */
export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await siteSettingsService.getSettings();
  return sendSuccessResponse(res, 200, "Settings fetched successfully", settings);
});

/**
 * Update Site Settings
 * PUT /api/v1/site-settings
 */
export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const existingSettings = await siteSettingsService.getSettings();
  let { siteName, tagline, contactEmail, contactPhone, themeColors, paymentMethods, razorpayKeyId, razorpayKeySecret, freeShippingThreshold, freeShippingEnabled, whatsappConfig } = req.body;

  // Smartly handle themeColors: parse if string, and ensure it's an object
  let parsedThemeColors = themeColors;
  if (typeof themeColors === "string") {
    try {
      parsedThemeColors = JSON.parse(themeColors);
    } catch (e) {
      console.warn("Failed to parse themeColors JSON, using existing or defaults");
      parsedThemeColors = existingSettings.themeColors;
    }
  }

  // Ensure we have a valid object for themeColors, otherwise fallback to existing
  if (!parsedThemeColors || typeof parsedThemeColors !== "object") {
    parsedThemeColors = existingSettings.themeColors;
  }

  // Handle paymentMethods: parse if string
  let parsedPaymentMethods = paymentMethods;
  if (typeof paymentMethods === "string") {
    try {
      parsedPaymentMethods = JSON.parse(paymentMethods);
    } catch (e) {
      console.warn("Failed to parse paymentMethods JSON, using existing or defaults");
      parsedPaymentMethods = existingSettings.paymentMethods;
    }
  }
  if (!parsedPaymentMethods || typeof parsedPaymentMethods !== "object") {
    parsedPaymentMethods = existingSettings.paymentMethods;
  }

  // Handle whatsappConfig: parse if string
  let parsedWhatsappConfig = whatsappConfig;
  if (typeof whatsappConfig === "string") {
    try {
      parsedWhatsappConfig = JSON.parse(whatsappConfig);
    } catch (e) {
      console.warn("Failed to parse whatsappConfig JSON, using existing or defaults");
      parsedWhatsappConfig = existingSettings.whatsappConfig;
    }
  }

  let logoUrl = existingSettings.logo;
  const file = req.file;

  if (file) {
    // Upload new logo
    const result = await uploadToCloudinary(file.path, {
      folder: "kidroo/site-settings",
    });
    logoUrl = result.url;

    // Delete old logo from Cloudinary if it exists
    if (existingSettings.logo) {
      const oldPublicId = extractPublicId(existingSettings.logo);
      if (oldPublicId) {
        try {
          await deleteFromCloudinary(oldPublicId, "image");
        } catch (error) {
          console.error(`Failed to delete old logo ${oldPublicId} from Cloudinary:`, error);
        }
      }
    }

    // Clean up local file (although uploadToCloudinary already does this, safety check)
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }

  // Build razorpay config update (only update fields that were provided)
  const razorpayConfigObj: any = {};
  if (razorpayKeyId !== undefined) {
    razorpayConfigObj.keyId = razorpayKeyId;
  }
  if (razorpayKeySecret !== undefined && razorpayKeySecret !== "") {
    razorpayConfigObj.keySecret = razorpayKeySecret;
  }

  const updateData: any = {
    siteName,
    tagline,
    contactEmail,
    contactPhone,
    themeColors: parsedThemeColors,
    logo: logoUrl || "",
    paymentMethods: parsedPaymentMethods,
  };

  if (parsedWhatsappConfig && typeof parsedWhatsappConfig === "object") {
    updateData.whatsappConfig = {
      ...existingSettings.whatsappConfig,
      ...parsedWhatsappConfig,
    };
  }

  if (freeShippingThreshold !== undefined) {
    updateData.freeShippingThreshold = Number(freeShippingThreshold);
  }
  if (freeShippingEnabled !== undefined) {
    updateData.freeShippingEnabled = freeShippingEnabled === "true" || freeShippingEnabled === true;
  }

  // Only update razorpay config fields if provided
  if (Object.keys(razorpayConfigObj).length > 0) {
    if (razorpayConfigObj.keyId !== undefined) {
      updateData["razorpayConfig.keyId"] = razorpayConfigObj.keyId;
    }
    if (razorpayConfigObj.keySecret !== undefined) {
      updateData["razorpayConfig.keySecret"] = razorpayConfigObj.keySecret;
    }
  }

  const updatedSettings = await siteSettingsService.updateSettings(updateData);

  return sendSuccessResponse(res, 200, "Settings updated successfully", updatedSettings);
});
