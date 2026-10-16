import { Request, Response } from "express";
import mongoose from "mongoose";
import Customer from "../models/customer";
import SmsCampaign from "../models/smsCampaign";
import { sendSuccessResponse } from "../utils/apiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import AppError from "../utils/appError";
import { sendWhatsAppBroadcast } from "../services/metaWhatsappService";
import WhatsAppTemplate from "../models/whatsappTemplate";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// 90 days ago — "at risk" threshold
const atRiskDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d;
};

// Start of current month
const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

// ── Group label map ──────────────────────────────────────────────────────────
const GROUP_LABELS: Record<string, string> = {
  all:        "All Customers",
  repeat:     "Repeat Buyers",
  high_value: "VIP Customers",
  new:        "New This Month",
  at_risk:    "At-Risk Customers",
  custom:     "Selected Customers",
};

type BroadcastRecipient = { mobile: string; name: string };

// ─────────────────────────────────────────────────────────────────────────────
// resolveTargetCustomers
// Returns { _id, firstName, lastName, mobile } for the target group
// ─────────────────────────────────────────────────────────────────────────────
async function resolveTargetCustomers(
  targetGroup: string,
  targetIds: string[]
): Promise<BroadcastRecipient[]> {
  // Custom selection — use the exact IDs provided
  if (targetGroup === "custom" && targetIds.length > 0) {
    const docs = await Customer.find(
      { _id: { $in: targetIds }, isActive: true, mobile: { $exists: true, $ne: "" } },
      { firstName: 1, lastName: 1, mobile: 1 }
    ).lean();
    return docs.map((d: any) => ({
      mobile: d.mobile,
      name: `${d.firstName || "Valued"} ${d.lastName || "Customer"}`.trim(),
    }));
  }

  // Group-based — aggregate with order stats
  const monthStart = startOfMonth();
  const riskDate   = atRiskDate();

  const pipeline: mongoose.PipelineStage[] = [
    {
      $match: {
        isActive: true,
        mobile:   { $exists: true, $ne: "" }, // only customers with a WhatsApp number
      },
    },
    {
      $lookup: {
        from:         "orders",
        localField:   "_id",
        foreignField: "customerId",
        as:           "orders",
      },
    },
    {
      $addFields: {
        orderCount:     { $size: "$orders" },
        totalSpent:     { $sum: "$orders.totalAmount" },
        lastOrderDate:  { $max: "$orders.createdAt" },
        isNewThisMonth: { $gte: ["$createdAt", monthStart] },
      },
    },
  ];

  switch (targetGroup) {
    case "all":
      // already matched isActive above
      break;
    case "repeat":
      pipeline.push({ $match: { orderCount: { $gt: 1 } } });
      break;
    case "high_value":
      pipeline.push({ $match: { totalSpent: { $gte: 1000 } } });
      break;
    case "new":
      pipeline.push({ $match: { isNewThisMonth: true } });
      break;
    case "at_risk":
      pipeline.push({
        $match: {
          orderCount:    { $gt: 0 },
          lastOrderDate: { $lt: riskDate },
        },
      });
      break;
    default:
      break; // fall through — all active customers
  }

  pipeline.push({ $project: { firstName: 1, lastName: 1, mobile: 1 } });

  const docs: any[] = await Customer.aggregate(pipeline);
  return docs.map((d) => ({
    mobile: d.mobile,
    name: `${d.firstName || "Valued"} ${d.lastName || "Customer"}`.trim(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/sms-campaigns/stats
// ─────────────────────────────────────────────────────────────────────────────
export const getCampaignStats = asyncHandler(async (_req: Request, res: Response) => {
  const monthStart = startOfMonth();

  const [agg] = await SmsCampaign.aggregate([
    { $match: { status: "sent" } },
    {
      $group: {
        _id:           null,
        totalSent:     { $sum: "$sentCount" },
        totalDelivered:{ $sum: "$deliveredCount" },
        totalFailed:   { $sum: "$failedCount" },
        campaignCount: { $sum: 1 },
        thisMonthCount: {
          $sum: { $cond: [{ $gte: ["$sentAt", monthStart] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalSent: 1,
        totalDelivered: 1,
        totalFailed: 1,
        campaignCount: 1,
        thisMonthCount: 1,
        deliveryRate: {
          $cond: [
            { $gt: ["$totalSent", 0] },
            { $round: [{ $multiply: [{ $divide: ["$totalDelivered", "$totalSent"] }, 100] }, 1] },
            0,
          ],
        },
      },
    },
  ]);

  return sendSuccessResponse(res, 200, "Campaign stats fetched", agg || {
    totalSent: 0, totalDelivered: 0, totalFailed: 0,
    campaignCount: 0, thisMonthCount: 0, deliveryRate: 0,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/sms-campaigns
// ─────────────────────────────────────────────────────────────────────────────
export const getAllCampaigns = asyncHandler(async (_req: Request, res: Response) => {
  const campaigns = await SmsCampaign.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return sendSuccessResponse(res, 200, "Campaigns fetched", campaigns);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sms-campaigns
// Creates and sends a WhatsApp broadcast via MSG91.
// Body: { name, message, targetGroup, targetIds?, targetLabel? }
// ─────────────────────────────────────────────────────────────────────────────
export const createAndSendCampaign = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    message,
    targetGroup  = "all",
    targetIds    = [] as string[],
    targetLabel,
    templateKey  = "promoBlast",
    sendNow      = true,
    saveOnly     = false,
  } = req.body;

  // ── Load template metadata if available ─────────────────────────────────────
  let defaultTitle = "WhatsApp Broadcast";
  let templateBody = "";
  if (templateKey) {
    const tplDoc = await WhatsAppTemplate.findOne({ eventKey: templateKey }).lean();
    if (tplDoc) {
      defaultTitle = tplDoc.title;
      templateBody = tplDoc.bodyFormat;
    }
  }

  // ── Defaults & Normalization ───────────────────────────────────────────────
  const campaignName =
    (name && String(name).trim()) ||
    `${defaultTitle} - ${new Date().toLocaleDateString("en-IN")}`;
  const promoMessage =
    (message && String(message).trim()) ||
    templateBody ||
    "Special store offers and discounts at Kidroo Toys!";

  // ── Resolve recipients ───────────────────────────────────────────────────────
  const recipients = await resolveTargetCustomers(
    String(targetGroup),
    Array.isArray(targetIds) ? (targetIds as string[]) : []
  );

  if (recipients.length === 0) {
    throw new AppError(
      "No active customers with a mobile number found for the selected group",
      400
    );
  }

  // ── Save as Draft (If admin chose to save without sending directly) ─────────
  const shouldSendDirect = sendNow === true && !saveOnly && req.body.status !== "draft";

  if (!shouldSendDirect) {
    const label =
      (targetLabel as string) ||
      (targetGroup === "custom"
        ? `${recipients.length} Selected Customers`
        : GROUP_LABELS[String(targetGroup)] ?? "All Customers");

    const campaign = await SmsCampaign.create({
      name:        campaignName,
      message:     promoMessage,
      channel:     "whatsapp",
      templateKey: String(templateKey),
      targetGroup,
      targetLabel: label,
      targetIds:
        targetGroup === "custom"
          ? (targetIds as string[]).map((id) => new mongoose.Types.ObjectId(id))
          : [],
      recipients: recipients.map((r) => ({
        mobile: r.mobile,
        name: r.name,
        status: "draft" as const,
        errorReason: "",
      })),
      status:         "draft",
      sentCount:      0,
      deliveredCount: 0,
      failedCount:    0,
    });

    return sendSuccessResponse(
      res,
      201,
      `Campaign "${campaignName}" saved as draft (${recipients.length} recipients queued)`,
      campaign
    );
  }

  // ── Send WhatsApp broadcast directly via Meta Cloud API ────────────────────
  const { sent, failed, results } = await sendWhatsAppBroadcast(
    recipients,
    promoMessage,
    String(templateKey)
  );
  const delivered = sent;

  // ── Resolve label ────────────────────────────────────────────────────────────
  const label =
    (targetLabel as string) ||
    (targetGroup === "custom"
      ? `${sent} Selected Customers`
      : GROUP_LABELS[String(targetGroup)] ?? "All Customers");

  // ── Persist campaign record with per-recipient delivery statuses ────────────
  const campaign = await SmsCampaign.create({
    name:        campaignName,
    message:     promoMessage,
    channel:     "whatsapp",
    templateKey: String(templateKey),
    targetGroup,
    targetLabel: label,
    targetIds:
      targetGroup === "custom"
        ? (targetIds as string[]).map((id) => new mongoose.Types.ObjectId(id))
        : [],
    recipients: results.map((r) => ({
      mobile: r.mobile,
      name: r.name,
      status: r.status,
      errorReason: r.errorReason || "",
      deliveredAt: r.status === "delivered" ? new Date() : undefined,
    })),
    status:        "sent",
    sentCount:     sent,
    deliveredCount: delivered,
    failedCount:   failed,
    sentAt:        new Date(),
  });

  return sendSuccessResponse(
    res,
    201,
    `WhatsApp broadcast sent to ${sent} customers (${delivered} delivered, ${failed} failed)`,
    campaign
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/sms-campaigns/:id
// Returns campaign details with structured delivery report & recipient breakdown
// ─────────────────────────────────────────────────────────────────────────────
export const getCampaignById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError("Invalid ID", 400);

  const campaign = await SmsCampaign.findById(new mongoose.Types.ObjectId(id)).lean();
  if (!campaign) throw new AppError("Campaign not found", 404);

  let recipientsList = campaign.recipients || [];

  // If older campaign has no recipient subdocuments stored, reconstruct from targetGroup
  if (recipientsList.length === 0) {
    const resolved = await resolveTargetCustomers(
      campaign.targetGroup,
      campaign.targetIds?.map((tId: any) => tId.toString()) || []
    );
    const isSent = campaign.status === "sent";
    recipientsList = resolved.map((r) => ({
      mobile: r.mobile,
      name: r.name,
      status: campaign.deliveredCount > 0 ? ("delivered" as const) : (isSent ? ("failed" as const) : ("sent" as const)),
      errorReason:
        campaign.failedCount > 0
          ? "Meta WhatsApp Cloud API Sandbox limitation: Phone number is not in the allowed test recipient list (#131030)"
          : "",
      deliveredAt: campaign.deliveredCount > 0 ? campaign.sentAt : undefined,
    }));
  }

  // Load template details if templateKey exists
  let templateInfo: any = null;
  if (campaign.templateKey) {
    const tpl = await WhatsAppTemplate.findOne({ eventKey: campaign.templateKey }).lean();
    if (tpl) {
      templateInfo = {
        title: tpl.title,
        metaTemplateName: tpl.metaTemplateName,
        icon: tpl.icon,
        triggerEvent: tpl.triggerEvent,
        headerText: tpl.headerText,
        bodyFormat: tpl.bodyFormat,
        buttonLabel: tpl.buttonLabel,
      };
    }
  }

  const isCampaignDraft = campaign.status === "draft";

  // Calculate clean metrics
  const totalTargeted = recipientsList.length || campaign.sentCount || 0;
  const delivered = isCampaignDraft
    ? 0
    : (campaign.deliveredCount ?? recipientsList.filter((r: any) => r.status === "delivered").length);
  const failed = isCampaignDraft
    ? 0
    : (campaign.failedCount ?? recipientsList.filter((r: any) => r.status === "failed").length);
  const queued = isCampaignDraft
    ? totalTargeted
    : recipientsList.filter((r: any) => r.status === "sent" || r.status === "draft").length;
  const deliveryRate = totalTargeted > 0 ? Number(((delivered / totalTargeted) * 100).toFixed(1)) : 0;
  const failureRate = totalTargeted > 0 ? Number(((failed / totalTargeted) * 100).toFixed(1)) : 0;

  // Build structured error breakdown
  const errorMap = new Map<string, { reason: string; count: number; code: string }>();
  if (!isCampaignDraft) {
    for (const r of recipientsList) {
      if (r.status === "failed" && r.errorReason) {
        const isSandboxError =
          r.errorReason.includes("131030") ||
          r.errorReason.toLowerCase().includes("not in allowed list") ||
          r.errorReason.toLowerCase().includes("sandbox");
        const code = isSandboxError ? "131030" : "API_ERR";
        const key = isSandboxError ? "Meta Sandbox Test Number Restriction (#131030)" : r.errorReason;
        const current = errorMap.get(key) || {
          reason: isSandboxError
            ? "Meta Sandbox Restriction: Recipient number not added to Meta App allowed list (#131030)"
            : r.errorReason,
          count: 0,
          code,
        };
        current.count += 1;
        errorMap.set(key, current);
      }
    }
  }

  // Fetch matching customers to enrich with customerId, avatar, and full name
  const rawMobiles = recipientsList
    .map((r: any) => String(r.mobile || "").trim())
    .filter(Boolean);
  const searchVariants: string[] = [];
  rawMobiles.forEach((m: string) => {
    searchVariants.push(m);
    if (m.startsWith("+91")) searchVariants.push(m.slice(3));
    else if (m.length === 10) searchVariants.push(`+91${m}`);
  });

  const matchedCustomers = await Customer.find(
    { mobile: { $in: searchVariants } },
    { _id: 1, mobile: 1, firstName: 1, lastName: 1, avatar: 1 }
  ).lean();

  const customerByMobile = new Map<string, any>();
  for (const c of matchedCustomers) {
    if (c.mobile) {
      const clean = String(c.mobile).trim();
      customerByMobile.set(clean, c);
      if (clean.startsWith("+91")) customerByMobile.set(clean.slice(3), c);
      else if (clean.length === 10) customerByMobile.set(`+91${clean}`, c);
    }
  }

  // Clean recipients with formatted phone & helper flags
  const formattedRecipients = recipientsList.map((r: any) => {
    const cleanMobile = String(r.mobile || "").trim();
    let formattedMobile = cleanMobile;
    if (cleanMobile.startsWith("+91") && cleanMobile.length === 13) {
      formattedMobile = `+91 ${cleanMobile.slice(3, 8)} ${cleanMobile.slice(8)}`;
    } else if (cleanMobile.length === 10) {
      formattedMobile = `+91 ${cleanMobile.slice(0, 5)} ${cleanMobile.slice(5)}`;
    }

    const recipientStatus = isCampaignDraft ? "draft" : (r.status || "sent");

    const isSandboxError =
      !isCampaignDraft &&
      ((r.errorReason || "").includes("131030") ||
      (r.errorReason || "").toLowerCase().includes("not in allowed list") ||
      (r.errorReason || "").toLowerCase().includes("sandbox"));

    let simpleReason = "Delivered successfully";
    if (isCampaignDraft) {
      simpleReason = "Draft — Ready to send";
    } else if (recipientStatus === "failed") {
      if (isSandboxError) {
        simpleReason = "Test Mode: Number not added in WhatsApp test list";
      } else if ((r.errorReason || "").toLowerCase().includes("invalid")) {
        simpleReason = "Invalid phone number";
      } else {
        simpleReason = r.errorReason || "Message delivery failed";
      }
    } else if (recipientStatus === "sent" || recipientStatus === "draft") {
      simpleReason = isCampaignDraft ? "Draft — Ready to send" : "Queued to send";
    }

    const cust = customerByMobile.get(cleanMobile);

    return {
      _id: r._id,
      customerId: cust?._id ? cust._id.toString() : (r.customerId ? String(r.customerId) : null),
      name: cust ? `${cust.firstName || ""} ${cust.lastName || ""}`.trim() : (r.name || "Customer"),
      avatar: cust?.avatar || null,
      mobile: cleanMobile,
      formattedMobile,
      status: recipientStatus,
      simpleReason,
      errorReason: isCampaignDraft ? "" : (r.errorReason || ""),
      errorCode: isSandboxError ? "131030" : (r.errorReason ? "ERR" : null),
      isSandboxError,
      deliveredAt: r.deliveredAt || null,
    };
  });

  const responsePayload = {
    ...campaign,
    template: templateInfo,
    campaign: {
      _id: campaign._id,
      name: campaign.name,
      message: campaign.message,
      channel: campaign.channel || "whatsapp",
      templateKey: campaign.templateKey,
      template: templateInfo,
      targetGroup: campaign.targetGroup,
      targetLabel: campaign.targetLabel,
      status: campaign.status,
      sentAt: campaign.sentAt,
      createdAt: campaign.createdAt,
    },
    metrics: {
      totalTargeted,
      delivered,
      failed,
      queued,
      deliveryRate,
      failureRate,
    },
    errorBreakdown: Array.from(errorMap.values()),
    recipients: formattedRecipients,
  };

  return sendSuccessResponse(res, 200, "Campaign delivery report fetched", responsePayload);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/sms-campaigns/:id/send
// Sends a previously saved draft campaign
// ─────────────────────────────────────────────────────────────────────────────
export const sendExistingDraftCampaign = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError("Invalid ID", 400);

  const campaign = await SmsCampaign.findById(new mongoose.Types.ObjectId(id));
  if (!campaign) throw new AppError("Campaign not found", 404);

  // Resolve recipients
  const recipients = await resolveTargetCustomers(
    campaign.targetGroup,
    campaign.targetIds?.map((tId) => tId.toString()) || []
  );

  if (recipients.length === 0) {
    throw new AppError("No active customers with a mobile number found for this campaign", 400);
  }

  const { sent, failed, results } = await sendWhatsAppBroadcast(
    recipients,
    campaign.message,
    campaign.templateKey || "promoBlast"
  );

  campaign.status = "sent";
  campaign.sentCount = sent;
  campaign.deliveredCount = sent;
  campaign.failedCount = failed;
  campaign.sentAt = new Date();
  campaign.recipients = results.map((r) => ({
    mobile: r.mobile,
    name: r.name,
    status: r.status,
    errorReason: r.errorReason || "",
    deliveredAt: r.status === "delivered" ? new Date() : undefined,
  })) as any;
  await campaign.save();

  return sendSuccessResponse(
    res,
    200,
    `WhatsApp broadcast sent to ${sent} customers (${sent} delivered, ${failed} failed)`,
    campaign
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/sms-campaigns/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteCampaign = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError("Invalid ID", 400);
  await SmsCampaign.findByIdAndDelete(new mongoose.Types.ObjectId(id));
  return sendSuccessResponse(res, 200, "Campaign deleted");
});
