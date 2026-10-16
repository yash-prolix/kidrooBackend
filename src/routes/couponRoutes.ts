import { Router } from "express";
import {
  getAllCoupons,
  getPublicCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  sendOfferWhatsAppNotification,
} from "../controller/couponController";
import { getOfferAndCouponAnalytics } from "../controller/analyticsController";
import {
  authMiddleware,
  authorizationMiddleware,
} from "../middlewares/authMiddleware";
import { validateRequest } from "../middlewares/validateRequest";
import { checkPermission } from "../middlewares/permissionMiddleware";
import {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
} from "../utils/validators/couponValidators";

const router = Router();

/**
 * @swagger
 * /api/coupons/analytics:
 *   get:
 *     summary: Get coupon & offer analytics (Admin)
 *     tags:
 *       - Coupons
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [weekly, monthly, yearly]
 *     responses:
 *       200:
 *         description: Coupon & offer usage analytics
 */
router.get(
  "/analytics",
  authMiddleware,
  authorizationMiddleware(["admin", "moderator"]),
  checkPermission("/offers"),
  getOfferAndCouponAnalytics
);

/**
 * @swagger
 * /api/coupons/public:
 *   get:
 *     summary: Get public coupons (User-facing)
 *     description: Fetch all publicly visible, active, and non-expired coupons
 *     tags:
 *       - Coupons
 *     responses:
 *       200:
 *         description: Public coupons list
 */
router.get("/public", getPublicCoupons);

/**
 * @swagger
 * /api/coupons/validate:
 *   post:
 *     summary: Validate a coupon code against cart
 *     description: Check if coupon is valid, calculate discount for applicable products
 *     tags:
 *       - Coupons
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - cartItems
 *             properties:
 *               code:
 *                 type: string
 *               cartItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     price:
 *                       type: number
 *     responses:
 *       200:
 *         description: Coupon is valid, returns discount details
 *       400:
 *         description: Coupon is invalid
 */
router.post(
  "/validate",
  authMiddleware,
  validateRequest(validateCouponSchema),
  validateCoupon
);

/**
 * @swagger
 * /api/coupons:
 *   get:
 *     summary: Get all coupons (Admin)
 *     tags:
 *       - Coupons
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *           enum: [public, private]
 *     responses:
 *       200:
 *         description: All coupons
 */
router.get(
  "/",
  authMiddleware,
  authorizationMiddleware(["admin", "moderator"]),
  checkPermission("/offers"),
  getAllCoupons
);

/**
 * @swagger
 * /api/coupons/{id}:
 *   get:
 *     summary: Get coupon by ID (Admin)
 *     tags:
 *       - Coupons
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon details
 */
router.get(
  "/:id",
  authMiddleware,
  authorizationMiddleware(["admin", "moderator"]),
  checkPermission("/offers"),
  getCouponById
);

/**
 * @swagger
 * /api/coupons:
 *   post:
 *     summary: Create a new coupon (Admin)
 *     tags:
 *       - Coupons
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - description
 *               - discountType
 *               - discountValue
 *               - validFrom
 *               - validTo
 *     responses:
 *       201:
 *         description: Coupon created
 */
router.post(
  "/",
  authMiddleware,
  authorizationMiddleware(["admin", "moderator"]),
  checkPermission("/offers"),
  validateRequest(createCouponSchema),
  createCoupon
);

/**
 * @swagger
 * /api/coupons/{id}:
 *   put:
 *     summary: Update coupon (Admin)
 *     tags:
 *       - Coupons
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon updated
 */
router.put(
  "/:id",
  authMiddleware,
  authorizationMiddleware(["admin", "moderator"]),
  checkPermission("/offers"),
  validateRequest(updateCouponSchema),
  updateCoupon
);

/**
 * @swagger
 * /api/coupons/{id}:
 *   delete:
 *     summary: Delete coupon (Admin)
 *     tags:
 *       - Coupons
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coupon deleted
 */
router.delete(
  "/:id",
  authMiddleware,
  authorizationMiddleware(["admin", "moderator"]),
  checkPermission("/offers"),
  deleteCoupon
);

/**
 * @swagger
 * /api/coupons/{id}/send-whatsapp:
 *   post:
 *     summary: Send offer WhatsApp notification to all or selected customers (Admin)
 *     tags:
 *       - Coupons
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: WhatsApp offer broadcast triggered
 */
router.post(
  "/:id/send-whatsapp",
  authMiddleware,
  authorizationMiddleware(["admin", "moderator"]),
  checkPermission("/offers"),
  sendOfferWhatsAppNotification
);

export default router;
