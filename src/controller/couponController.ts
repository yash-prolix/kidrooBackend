import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import AppError from "../utils/appError";
import { CacheService } from "../services/redisCacheService";
import { sendSuccessResponse } from "../utils/apiResponse";
import { couponService } from "../services/couponService";
import mongoose from "mongoose";
import Customer from "../models/customer";
import { sendWhatsAppBroadcast } from "../services/metaWhatsappService";

/**
 * Get All Coupons (Admin)
 * GET /api/coupons
 */
export const getAllCoupons = asyncHandler(
  async (req: Request, res: Response) => {
    const { search, visibility } = req.query;
    const searchTerm = typeof search === "string" ? search : undefined;
    const visibilityFilter = typeof visibility === "string" ? visibility : undefined;

    const coupons = await couponService.getAllCoupons(searchTerm, visibilityFilter);
    return sendSuccessResponse(res, 200, "Coupons fetched successfully", coupons);
  }
);

/**
 * Get Public Coupons (User-facing)
 * GET /api/coupons/public
 */
export const getPublicCoupons = asyncHandler(
  async (req: Request, res: Response) => {
    const cacheKey = "coupons:public";
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return sendSuccessResponse(res, 200, "Public coupons fetched successfully", cached);
    }

    const coupons = await couponService.getPublicCoupons();
    await CacheService.set(cacheKey, coupons, 300);

    return sendSuccessResponse(res, 200, "Public coupons fetched successfully", coupons);
  }
);

/**
 * Get Coupon by ID (Admin)
 * GET /api/coupons/:id
 */
export const getCouponById = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid coupon ID format", 400);
    }

    const coupon = await couponService.getCouponById(id);
    if (!coupon) {
      throw new AppError("Coupon not found", 404);
    }

    return sendSuccessResponse(res, 200, "Coupon fetched successfully", coupon);
  }
);

/**
 * Create a new coupon (Admin)
 * POST /api/coupons
 */
export const createCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      minQuantity,
      applicableProducts,
      validFrom,
      validTo,
      usageLimit,
      perUserLimit,
      isActive,
      visibility,
      sendWhatsAppNotification,
      targetGroup = "all",
      targetIds = [],
      customMessage,
    } = req.body;

    if (!code || !description || !discountType || discountValue === undefined) {
      throw new AppError("code, description, discountType, and discountValue are required", 400);
    }

    if (!validFrom || !validTo) {
      throw new AppError("validFrom and validTo are required", 400);
    }

    // Check for duplicate code
    const existing = await couponService.getCouponByCode(code);
    if (existing) {
      throw new AppError("A coupon with this code already exists", 400);
    }

    const coupon = await couponService.createCoupon({
      code: code.toUpperCase().trim(),
      description,
      discountType,
      discountValue: Number(discountValue),
      minOrderAmount: minOrderAmount ? Number(minOrderAmount) : 0,
      maxDiscount: maxDiscount ? Number(maxDiscount) : null,
      minQuantity: minQuantity ? Number(minQuantity) : 0,
      applicableProducts: applicableProducts || [],
      validFrom: new Date(validFrom),
      validTo: new Date(validTo),
      usageLimit: usageLimit ? Number(usageLimit) : 100,
      perUserLimit: perUserLimit ? Number(perUserLimit) : 1,
      isActive: isActive !== undefined ? isActive === "true" || isActive === true : true,
      visibility: visibility || "public",
    });

    await CacheService.del("coupons:public");

    // Optional: Send WhatsApp broadcast immediately upon coupon creation
    let whatsappStats = null;
    if (sendWhatsAppNotification === true || sendWhatsAppNotification === "true") {
      try {
        let query: any = { mobile: { $exists: true, $ne: "" }, isActive: true };
        if (targetGroup === "custom" && Array.isArray(targetIds) && targetIds.length > 0) {
          query._id = { $in: targetIds };
        }
        const customers = await Customer.find(query).select("firstName lastName mobile");
        const recipients = customers.map((c) => ({
          mobile: c.mobile,
          name: `${c.firstName || "Valued"} ${c.lastName || "Customer"}`.trim(),
        }));

        const discountText = discountType === "percentage" ? `${discountValue}% OFF` : `₹${discountValue} OFF`;
        const promoText = customMessage || `🎉 Special Offer! Use code *${coupon.code}* to get ${discountText}. ${description}`;

        whatsappStats = await sendWhatsAppBroadcast(recipients, promoText);
      } catch (err: any) {
        console.error("[Coupon WhatsApp] Error sending broadcast on creation:", err?.message);
      }
    }

    return sendSuccessResponse(res, 201, "Coupon created successfully", { coupon, whatsappStats });
  }
);

/**
 * Update coupon (Admin)
 * PUT /api/coupons/:id
 */
export const updateCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid coupon ID format", 400);
    }

    const existing = await couponService.getCouponById(id);
    if (!existing) {
      throw new AppError("Coupon not found", 404);
    }

    const updateData: any = { ...req.body };

    // Normalize types
    if (updateData.discountValue !== undefined) updateData.discountValue = Number(updateData.discountValue);
    if (updateData.minOrderAmount !== undefined) updateData.minOrderAmount = Number(updateData.minOrderAmount);
    if (updateData.maxDiscount !== undefined) updateData.maxDiscount = updateData.maxDiscount ? Number(updateData.maxDiscount) : null;
    if (updateData.minQuantity !== undefined) updateData.minQuantity = Number(updateData.minQuantity);
    if (updateData.usageLimit !== undefined) updateData.usageLimit = Number(updateData.usageLimit);
    if (updateData.perUserLimit !== undefined) updateData.perUserLimit = Number(updateData.perUserLimit);
    if (updateData.isActive !== undefined) updateData.isActive = updateData.isActive === "true" || updateData.isActive === true;
    if (updateData.code) updateData.code = updateData.code.toUpperCase().trim();
    if (updateData.validFrom) updateData.validFrom = new Date(updateData.validFrom);
    if (updateData.validTo) updateData.validTo = new Date(updateData.validTo);

    // If code changed, check for duplicates
    if (updateData.code && updateData.code !== (existing as any).code) {
      const dup = await couponService.getCouponByCode(updateData.code);
      if (dup) {
        throw new AppError("A coupon with this code already exists", 400);
      }
    }

    const coupon = await couponService.updateCoupon(id, updateData);

    await CacheService.del("coupons:public");

    return sendSuccessResponse(res, 200, "Coupon updated successfully", coupon);
  }
);

/**
 * Delete coupon (Admin)
 * DELETE /api/coupons/:id
 */
export const deleteCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid coupon ID format", 400);
    }

    const coupon = await couponService.getCouponById(id);
    if (!coupon) {
      throw new AppError("Coupon not found", 404);
    }

    await couponService.deleteCoupon(id);

    await CacheService.del("coupons:public");

    return sendSuccessResponse(res, 200, "Coupon deleted successfully", null);
  }
);

/**
 * Validate coupon (Customer)
 * POST /api/coupons/validate
 */
export const validateCoupon = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, cartItems } = req.body;
    const customerId = (req as any).userId || (req as any).customerId;

    if (!code) {
      throw new AppError("Coupon code is required", 400);
    }

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      throw new AppError("Cart items are required", 400);
    }

    const result = await couponService.validateCoupon(code, customerId, cartItems);

    return sendSuccessResponse(
      res,
      result.valid ? 200 : 400,
      result.message,
      result
    );
  }
);

/**
 * Send WhatsApp Offer Broadcast to All or Selected Customers (Admin)
 * POST /api/coupons/:id/send-whatsapp
 */
export const sendOfferWhatsAppNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { targetGroup = "all", targetIds = [], customMessage } = req.body;

    const coupon = await couponService.getCouponById(id);
    if (!coupon) {
      throw new AppError("Coupon not found", 404);
    }

    let query: any = { mobile: { $exists: true, $ne: "" }, isActive: true };
    if (targetGroup === "custom" && Array.isArray(targetIds) && targetIds.length > 0) {
      query._id = { $in: targetIds };
    }

    const customers = await Customer.find(query).select("firstName lastName mobile");
    if (customers.length === 0) {
      throw new AppError("No active customers with a mobile number found for the selected target group", 400);
    }

    const recipients = customers.map((c) => ({
      mobile: c.mobile,
      name: `${c.firstName || "Valued"} ${c.lastName || "Customer"}`.trim(),
    }));

    const discountText = coupon.discountType === "percentage" ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`;
    const promoText = customMessage || `🎉 Exclusive Offer! Use code *${coupon.code}* to get ${discountText}. ${coupon.description}`;

    const { sent, failed } = await sendWhatsAppBroadcast(recipients, promoText);

    return sendSuccessResponse(res, 200, `Offer WhatsApp notification broadcast completed`, {
      couponCode: coupon.code,
      totalRecipients: recipients.length,
      sent,
      failed,
      targetGroup,
    });
  }
);
