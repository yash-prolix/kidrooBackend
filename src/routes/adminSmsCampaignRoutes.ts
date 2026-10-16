import { Router } from "express";
import {
  getCampaignStats,
  getAllCampaigns,
  getCampaignById,
  createAndSendCampaign,
  sendExistingDraftCampaign,
  deleteCampaign,
} from "../controller/adminSmsCampaignController";
import { authMiddleware, authorizationMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// All routes: admin only
router.use(authMiddleware, authorizationMiddleware(["admin"]));

// GET /api/admin/sms-campaigns/stats  ← must be before /:id
router.get("/stats", getCampaignStats);

// GET /api/admin/sms-campaigns
router.get("/", getAllCampaigns);

// GET /api/admin/sms-campaigns/:id
router.get("/:id", getCampaignById);

// POST /api/admin/sms-campaigns
router.post("/", createAndSendCampaign);

// POST /api/admin/sms-campaigns/:id/send
router.post("/:id/send", sendExistingDraftCampaign);

// DELETE /api/admin/sms-campaigns/:id
router.delete("/:id", deleteCampaign);

export default router;
