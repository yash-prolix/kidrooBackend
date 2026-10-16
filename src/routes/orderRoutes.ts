import { Router } from "express";
import {
  createOrder,
  verifyPayment,
  getMyOrders,
  getMyOrderById,
  getShippingEstimate,
  getAllOrders,
  getAdminOrderById,
  updateOrderStatus,
  adminConfirmOrder,
  sendOrderWhatsAppNotification,
} from "../controller/orderController";
import { getAdminDashboardAnalytics } from "../controller/analyticsController";
import { customerAuthMiddleware } from "../middlewares/customerAuthMiddleware";
import { authMiddleware } from "../middlewares/authMiddleware";

// --- Customer Order Routes ---
const customerRouter = Router();

// Endpoint to check shipping estimate does not strictly require full auth if guest checkout is needed,
// but since customer profiles exist, we protect it with customer auth
customerRouter.use(customerAuthMiddleware);
customerRouter.get("/shipping-estimate", getShippingEstimate);
customerRouter.post("/", createOrder);
customerRouter.post("/verify-payment", verifyPayment);
customerRouter.get("/", getMyOrders);
customerRouter.get("/:id", getMyOrderById);

// --- Admin Order Routes ---
const adminRouter = Router();
adminRouter.use(authMiddleware);

adminRouter.get("/analytics", getAdminDashboardAnalytics);
adminRouter.get("/", getAllOrders);
adminRouter.get("/:id", getAdminOrderById);
adminRouter.post("/:id/confirm", adminConfirmOrder);
adminRouter.patch("/:id/status", updateOrderStatus);
adminRouter.post("/:id/send-whatsapp", sendOrderWhatsAppNotification);

export { customerRouter as customerOrderRouter, adminRouter as adminOrderRouter };
