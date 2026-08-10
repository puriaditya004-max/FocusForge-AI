const crypto = require("crypto");
const prisma = require("../config/db");
const logger = require("../utils/logger");
const {
  addDays,
  getAccessEndsAt,
  getEffectiveSubscriptionStatus,
  refreshSubscriptionLifecycle,
} = require("../utils/subscriptionLifecycle");

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";
const TRIAL_DAYS = Number(process.env.SUBSCRIPTION_TRIAL_DAYS || 30);
const GRACE_DAYS = Number(process.env.SUBSCRIPTION_GRACE_DAYS || 3);

const PLAN_CONFIG = {
  STUDENT_MONTHLY: {
    label: "Student Monthly",
    amountPaise: Number(process.env.STUDENT_MONTHLY_AMOUNT_PAISE || 19900),
    durationDays: 30,
  },
  STUDENT_YEARLY: {
    label: "Student Yearly",
    amountPaise: Number(process.env.STUDENT_YEARLY_AMOUNT_PAISE || 149900),
    durationDays: 365,
  },
  FAMILY: {
    label: "Family Plan",
    amountPaise: Number(process.env.FAMILY_MONTHLY_AMOUNT_PAISE || 29900),
    durationDays: 30,
  },
};

function getRazorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const err = new Error("Razorpay keys are not configured.");
    err.status = 503;
    throw err;
  }
  return { keyId, keySecret };
}

function timingSafeEqualHex(left, right) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyCheckoutSignature(orderId, paymentId, receivedSignature, keySecret) {
  if (!orderId || !paymentId || !receivedSignature) return false;

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return timingSafeEqualHex(expected, receivedSignature);
}

function normalizePlan(plan) {
  const safePlan = String(plan || "").toUpperCase();
  return PLAN_CONFIG[safePlan] ? safePlan : null;
}

function assertPaymentMatchesPlan(payment) {
  const planConfig = PLAN_CONFIG[payment.plan];
  if (!planConfig) {
    const err = new Error("Subscription plan is invalid.");
    err.status = 409;
    throw err;
  }

  if (payment.amountPaise !== planConfig.amountPaise || payment.currency !== "INR") {
    const err = new Error("Subscription payment amount does not match the selected plan.");
    err.status = 409;
    throw err;
  }

  return planConfig;
}

function formatSubscription(subscription) {
  if (!subscription) {
    return {
      status: "NONE",
      plan: null,
      trialAvailable: true,
      accessEndsAt: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      graceEndsAt: null,
      source: "NONE",
      owner: null,
    };
  }

  return {
    id: subscription.id,
    plan: subscription.plan,
    status: getEffectiveSubscriptionStatus(subscription),
    storedStatus: subscription.status,
    trialAvailable: false,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEnd: subscription.currentPeriodEnd,
    graceEndsAt: subscription.graceEndsAt,
    accessEndsAt: getAccessEndsAt(subscription),
    razorpaySubscriptionId: subscription.razorpaySubscriptionId,
    source: subscription.source || "OWN",
    owner: subscription.owner || null,
  };
}

async function getInheritedFamilySubscription(userId) {
  const link = await prisma.studentParentLink.findFirst({
    where: {
      studentId: userId,
      status: "APPROVED",
      parent: {
        subscription: {
          plan: "FAMILY",
          status: { in: ["ACTIVE", "TRIALING"] },
        },
      },
    },
    include: {
      parent: {
        select: {
          id: true,
          name: true,
          email: true,
          subscription: true,
        },
      },
    },
    orderBy: { connectedAt: "asc" },
  });

  const parentSubscription = await refreshSubscriptionLifecycle(prisma, link?.parent?.subscription);
  if (!parentSubscription) return null;
  return {
    ...parentSubscription,
    source: "FAMILY_PARENT",
    owner: {
      id: link.parent.id,
      name: link.parent.name,
      email: link.parent.email,
    },
  };
}

async function getEffectiveSubscriptionForUser(userId) {
  const ownSubscription = await refreshSubscriptionLifecycle(
    prisma,
    await prisma.subscription.findUnique({ where: { userId } })
  );
  if (["ACTIVE", "TRIALING", "GRACE"].includes(getEffectiveSubscriptionStatus(ownSubscription))) {
    return ownSubscription;
  }
  return (await getInheritedFamilySubscription(userId)) || ownSubscription;
}

async function ensureSubscription(userId) {
  let subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (subscription) return subscription;

  const now = new Date();
  return prisma.subscription.create({
    data: {
      userId,
      plan: "TRIAL",
      status: "TRIALING",
      trialStartedAt: now,
      trialEndsAt: addDays(now, TRIAL_DAYS),
      currentPeriodStart: now,
      currentPeriodEnd: addDays(now, TRIAL_DAYS),
      graceEndsAt: addDays(addDays(now, TRIAL_DAYS), GRACE_DAYS),
    },
  });
}

async function createRazorpayOrder({ amountPaise, receipt, notes }) {
  const { keyId, keySecret } = getRazorpayConfig();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.description || "Failed to create Razorpay order.");
  }
  return data;
}

async function activateSubscriptionForPayment(payment, paymentId, signature) {
  const planConfig = assertPaymentMatchesPlan(payment);

  const now = new Date();
  const periodEnd = addDays(now, planConfig.durationDays);
  const graceEndsAt = addDays(periodEnd, GRACE_DAYS);

  return prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        razorpayPaymentId: paymentId || payment.razorpayPaymentId,
        razorpaySignature: signature || payment.razorpaySignature,
        paidAt: now,
      },
    });

    const subscription = await tx.subscription.update({
      where: { id: payment.subscriptionId },
      data: {
        plan: payment.plan,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        graceEndsAt,
      },
    });

    return { payment: updatedPayment, subscription };
  });
}

async function markSubscriptionPaymentFailedRecord(payment, paymentId) {
  if (!payment || payment.status === "PAID") return payment;

  return prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      status: "FAILED",
      razorpayPaymentId: paymentId || payment.razorpayPaymentId,
    },
  });
}

async function getMySubscription(req, res) {
  try {
    const userId = req.user.userId;
    const subscription = await getEffectiveSubscriptionForUser(userId);
    return res.json({ subscription: formatSubscription(subscription), plans: PLAN_CONFIG });
  } catch (err) {
    logger.error("getMySubscription error:", err);
    return res.status(500).json({ error: "Failed to load subscription." });
  }
}

async function startTrial(req, res) {
  try {
    const userId = req.user.userId;
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing) {
      return res.status(409).json({ error: "Trial or subscription already exists.", subscription: formatSubscription(existing) });
    }

    const subscription = await ensureSubscription(userId);
    return res.status(201).json({ message: "Free trial started.", subscription: formatSubscription(subscription) });
  } catch (err) {
    logger.error("startTrial error:", err);
    return res.status(500).json({ error: "Failed to start free trial." });
  }
}

async function createSubscriptionOrder(req, res) {
  try {
    const userId = req.user.userId;
    const plan = normalizePlan(req.body.plan);
    if (!plan) return res.status(400).json({ error: "Choose a valid subscription plan." });
    if (req.user.role === "PARENT" && plan !== "FAMILY") {
      return res.status(403).json({ error: "Parent accounts can activate the Family Plan only." });
    }

    const subscription = await ensureSubscription(userId);
    const planConfig = PLAN_CONFIG[plan];
    const receipt = `sub_${subscription.id.slice(-10)}_${Date.now().toString(36)}`.slice(0, 40);

    const razorpayOrder = await createRazorpayOrder({
      amountPaise: planConfig.amountPaise,
      receipt,
      notes: {
        type: "focusforge_subscription",
        userId,
        subscriptionId: subscription.id,
        plan,
      },
    });

    const payment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id,
        userId,
        plan,
        razorpayOrderId: razorpayOrder.id,
        amountPaise: planConfig.amountPaise,
        receipt,
      },
    });

    return res.status(201).json({
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentId: payment.id,
      plan: { id: plan, ...planConfig },
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
      },
    });
  } catch (err) {
    logger.error("createSubscriptionOrder error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to start subscription payment." });
  }
}

async function verifySubscriptionPayment(req, res) {
  try {
    const userId = req.user.userId;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const { keySecret } = getRazorpayConfig();

    const payment = await prisma.subscriptionPayment.findUnique({ where: { razorpayOrderId: razorpay_order_id } });
    if (!payment || payment.userId !== userId) return res.status(404).json({ error: "Subscription order not found." });

    if (payment.status === "PAID") {
      const subscription = await prisma.subscription.findUnique({ where: { id: payment.subscriptionId } });
      return res.json({ message: "Subscription already active.", subscription: formatSubscription(subscription) });
    }

    const signatureOk = verifyCheckoutSignature(
      payment.razorpayOrderId,
      razorpay_payment_id,
      razorpay_signature,
      keySecret
    );
    if (!signatureOk) return res.status(400).json({ error: "Payment signature verification failed." });

    const result = await activateSubscriptionForPayment(payment, razorpay_payment_id, razorpay_signature);
    return res.json({ message: "Subscription activated.", subscription: formatSubscription(result.subscription) });
  } catch (err) {
    logger.error("verifySubscriptionPayment error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to verify subscription payment." });
  }
}

async function markSubscriptionPaymentFailed(req, res) {
  try {
    const userId = req.user.userId;
    const { razorpay_order_id, razorpay_payment_id } = req.body;
    if (!razorpay_order_id) return res.status(400).json({ error: "Subscription order id is required." });

    const payment = await prisma.subscriptionPayment.findUnique({ where: { razorpayOrderId: razorpay_order_id } });
    if (!payment || payment.userId !== userId) return res.status(404).json({ error: "Subscription order not found." });

    if (payment.status === "PAID") {
      return res.json({ message: "Subscription payment is already paid.", status: payment.status });
    }

    const updatedPayment = await markSubscriptionPaymentFailedRecord(payment, razorpay_payment_id);
    return res.json({ message: "Subscription payment attempt saved.", status: updatedPayment.status });
  } catch (err) {
    logger.error("markSubscriptionPaymentFailed error:", err);
    return res.status(500).json({ error: "Failed to save subscription payment status." });
  }
}

async function cancelMySubscription(req, res) {
  try {
    const userId = req.user.userId;
    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) return res.status(404).json({ error: "Subscription not found." });
    if (subscription.status === "CANCELLED") {
      return res.json({ message: "Subscription already cancelled.", subscription: formatSubscription(subscription) });
    }

    const now = new Date();
    const cancelledSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "CANCELLED",
        currentPeriodEnd: now,
        graceEndsAt: now,
      },
    });

    return res.json({ message: "Subscription cancelled.", subscription: formatSubscription(cancelledSubscription) });
  } catch (err) {
    logger.error("cancelMySubscription error:", err);
    return res.status(500).json({ error: "Failed to cancel subscription." });
  }
}

async function processSubscriptionWebhookOrder({ orderId, paymentId }) {
  if (!orderId) return false;
  const payment = await prisma.subscriptionPayment.findUnique({ where: { razorpayOrderId: orderId } });
  if (!payment || payment.status === "PAID") return false;
  await activateSubscriptionForPayment(payment, paymentId || payment.razorpayPaymentId, payment.razorpaySignature);
  return true;
}

async function processSubscriptionWebhookFailure({ orderId, paymentId }) {
  if (!orderId) return false;
  const payment = await prisma.subscriptionPayment.findUnique({ where: { razorpayOrderId: orderId } });
  if (!payment || payment.status === "PAID") return false;
  await markSubscriptionPaymentFailedRecord(payment, paymentId);
  return true;
}

module.exports = {
  PLAN_CONFIG,
  formatSubscription,
  getEffectiveSubscriptionForUser,
  getMySubscription,
  startTrial,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  markSubscriptionPaymentFailed,
  cancelMySubscription,
  processSubscriptionWebhookOrder,
  processSubscriptionWebhookFailure,
};
