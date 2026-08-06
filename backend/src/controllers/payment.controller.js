const crypto = require("crypto");
const prisma = require("../config/db");
const logger = require("../utils/logger");

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";
const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 10);

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

function verifyWebhookSignature(rawBody, receivedSignature, webhookSecret) {
  if (!rawBody || !receivedSignature || !webhookSecret) return false;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  return timingSafeEqualHex(expected, receivedSignature);
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

function calculateSplit(amountPaise) {
  const platformFeePaise = Math.round(amountPaise * (PLATFORM_FEE_PERCENT / 100));
  return { platformFeePaise, teacherAmountPaise: Math.max(amountPaise - platformFeePaise, 0) };
}

async function createInvoiceForPayment(tx, paymentId) {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: {
      student: { select: { name: true, email: true } },
      course: { include: { teacher: { select: { name: true } } } },
    },
  });
  if (!payment || payment.status !== "PAID") return null;

  const existing = await tx.invoice.findUnique({ where: { paymentId } });
  if (existing) return existing;

  return tx.invoice.create({
    data: {
      paymentId,
      invoiceNumber: `FF-${new Date().getFullYear()}-${payment.id.slice(-8).toUpperCase()}`,
      studentName: payment.student.name,
      studentEmail: payment.student.email,
      teacherName: payment.course.teacher.name,
      courseTitle: payment.course.title,
      amountPaise: payment.amountPaise,
      platformFeePaise: payment.platformFeePaise,
      teacherAmountPaise: payment.teacherAmountPaise,
      currency: payment.currency,
    },
  });
}

async function approveEnrollmentForPayment(payment, paymentId, signature) {
  const paidAt = new Date();

  return prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        razorpayPaymentId: paymentId,
        razorpaySignature: signature || payment.razorpaySignature,
        paidAt,
      },
    });

    const enrollment = await tx.enrollment.update({
      where: { id: payment.enrollmentId },
      data: { status: "APPROVED", respondedAt: paidAt },
    });
    await createInvoiceForPayment(tx, updatedPayment.id);

    return { payment: updatedPayment, enrollment };
  });
}

// Razorpay Route — actually moves the teacher's share out of the
// captured payment into their linked account. Runs *after* the
// $transaction above commits (never hold a DB transaction open
// across an outbound HTTP call). Best-effort: any failure here is
// recorded on the payment as payoutStatus FAILED rather than
// thrown, since the student's payment and enrollment are already
// confirmed by this point and must not be rolled back over a
// payout problem. An admin can retry via retryPayout below.
async function attemptRoutePayout(paymentId) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { course: { include: { teacher: { select: { razorpayRouteAccountId: true } } } } },
    });

    if (!payment || payment.status !== "PAID") return;
    if (payment.payoutStatus === "PAID_OUT") return; // never double-transfer
    if (!payment.razorpayPaymentId) return;

    const routeAccountId = payment.course?.teacher?.razorpayRouteAccountId;
    if (!routeAccountId) {
      await prisma.payment.update({ where: { id: payment.id }, data: { payoutStatus: "NOT_READY" } });
      return;
    }

    const { keyId, keySecret } = getRazorpayConfig();
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const response = await fetch(`${RAZORPAY_API_BASE}/payments/${payment.razorpayPaymentId}/transfers`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        transfers: [
          {
            account: routeAccountId,
            amount: payment.teacherAmountPaise,
            currency: "INR",
            on_hold: false,
            notes: { paymentId: payment.id, courseId: payment.courseId },
          },
        ],
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      logger.error("Route transfer failed:", data?.error?.description || response.status);
      await prisma.payment.update({ where: { id: payment.id }, data: { payoutStatus: "FAILED" } });
      return;
    }

    const transferId = data?.items?.[0]?.id || data?.id || null;
    await prisma.payment.update({
      where: { id: payment.id },
      data: { payoutStatus: "PAID_OUT", payoutReference: transferId },
    });
  } catch (err) {
    logger.error("attemptRoutePayout error:", err);
    try {
      await prisma.payment.update({ where: { id: paymentId }, data: { payoutStatus: "FAILED" } });
    } catch (_) {
      // best-effort status write — swallow, the original error is already logged
    }
  }
}

// POST /api/admin/payments/:paymentId/retry-payout
// ADMIN — re-attempts a Route transfer for a payment stuck in
// NOT_READY, ROUTE_PENDING, or FAILED (e.g. the teacher linked
// their Route account *after* the course was already paid for).
async function retryPayout(req, res) {
  try {
    const { paymentId } = req.params;
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return res.status(404).json({ error: "Payment not found." });
    if (payment.status !== "PAID") {
      return res.status(400).json({ error: "Only PAID payments can be paid out." });
    }
    if (payment.payoutStatus === "PAID_OUT") {
      return res.status(409).json({ error: "This payment has already been paid out." });
    }

    await attemptRoutePayout(paymentId);
    const updated = await prisma.payment.findUnique({ where: { id: paymentId } });
    return res.json({ message: "Payout attempted.", payment: updated });
  } catch (err) {
    logger.error("retryPayout error:", err);
    return res.status(500).json({ error: "Failed to retry payout." });
  }
}

// POST /api/payments/courses/:courseId/order
async function createCoursePaymentOrder(req, res) {
  try {
    const studentId = req.user.userId;
    const { courseId } = req.params;
    const { contactNumber } = req.body;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { teacher: { select: { name: true, razorpayRouteAccountId: true } } },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found." });
    }

    const existing = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });

    if (existing?.status === "APPROVED") {
      return res.status(409).json({ error: "You're already enrolled in this course." });
    }

    if (course.price <= 0) {
      const enrollment = existing
        ? await prisma.enrollment.update({
            where: { id: existing.id },
            data: { status: "APPROVED", respondedAt: new Date(), contactNumber: contactNumber?.trim() || "" },
          })
        : await prisma.enrollment.create({
            data: { studentId, courseId, status: "APPROVED", respondedAt: new Date(), contactNumber: contactNumber?.trim() || "" },
          });

      return res.status(201).json({ free: true, enrollment });
    }

    const amountPaise = Math.round(Number(course.price) * 100);
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ error: "Course price is invalid." });
    }

    const enrollment = existing
      ? await prisma.enrollment.update({
          where: { id: existing.id },
          data: { status: "PENDING", respondedAt: null, contactNumber: contactNumber?.trim() || "online-payment" },
        })
      : await prisma.enrollment.create({
          data: { studentId, courseId, status: "PENDING", contactNumber: contactNumber?.trim() || "online-payment" },
        });

    const receipt = `ff_${enrollment.id.slice(-12)}_${Date.now().toString(36)}`.slice(0, 40);
    const { platformFeePaise, teacherAmountPaise } = calculateSplit(amountPaise);
    const razorpayOrder = await createRazorpayOrder({
      amountPaise,
      receipt,
      notes: {
        enrollmentId: enrollment.id,
        courseId,
        studentId,
        teacherId: course.teacherId,
        platformFeePaise,
        teacherAmountPaise,
        teacherRouteAccountId: course.teacher?.razorpayRouteAccountId || "",
      },
    });

    const payment = await prisma.payment.create({
      data: {
        enrollmentId: enrollment.id,
        studentId,
        courseId,
        razorpayOrderId: razorpayOrder.id,
        amountPaise,
        platformFeePaise,
        teacherAmountPaise,
        payoutStatus: course.teacher?.razorpayRouteAccountId ? "ROUTE_PENDING" : "NOT_READY",
        receipt,
      },
    });

    return res.status(201).json({
      keyId: process.env.RAZORPAY_KEY_ID,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
      },
      paymentId: payment.id,
      enrollmentId: enrollment.id,
      course: {
        id: course.id,
        title: course.title,
        teacherName: course.teacher.name,
        price: course.price,
      },
    });
  } catch (err) {
    logger.error("createCoursePaymentOrder error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to start payment." });
  }
}

// POST /api/payments/verify
async function verifyCoursePayment(req, res) {
  try {
    const studentId = req.user.userId;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const { keySecret } = getRazorpayConfig();

    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
      include: { enrollment: true },
    });

    if (!payment || payment.studentId !== studentId) {
      return res.status(404).json({ error: "Payment order not found." });
    }

    if (payment.status === "PAID") {
      return res.json({ message: "Payment already verified.", enrollment: payment.enrollment });
    }

    const signatureOk = verifyCheckoutSignature(
      payment.razorpayOrderId,
      razorpay_payment_id,
      razorpay_signature,
      keySecret
    );

    if (!signatureOk) {
      return res.status(400).json({ error: "Payment signature verification failed." });
    }

    const result = await approveEnrollmentForPayment(payment, razorpay_payment_id, razorpay_signature);
    await attemptRoutePayout(result.payment.id);
    return res.json({ message: "Payment verified. Enrollment approved.", enrollment: result.enrollment });
  } catch (err) {
    logger.error("verifyCoursePayment error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to verify payment." });
  }
}

async function listMyPayments(req, res) {
  try {
    const userId = req.user.userId;
    const where = req.user.role === "TEACHER"
      ? { course: { teacherId: userId } }
      : { studentId: userId };

    const payments = await prisma.payment.findMany({
      where,
      include: {
        course: { select: { id: true, title: true, teacherId: true } },
        invoice: true,
        refunds: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ payments });
  } catch (err) {
    logger.error("listMyPayments error:", err);
    return res.status(500).json({ error: "Failed to load payments." });
  }
}

async function requestRefund(req, res) {
  try {
    const userId = req.user.userId;
    const { paymentId } = req.params;
    const { reason } = req.body;

    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { refunds: true } });
    if (!payment || payment.studentId !== userId) return res.status(404).json({ error: "Payment not found." });
    if (payment.status !== "PAID") return res.status(400).json({ error: "Only paid payments can be refunded." });
    if (payment.refunds.some((r) => ["REQUESTED", "PROCESSING", "PROCESSED"].includes(r.status))) {
      return res.status(409).json({ error: "A refund already exists for this payment." });
    }

    const refund = await prisma.paymentRefund.create({
      data: {
        paymentId,
        requestedById: userId,
        amountPaise: payment.amountPaise,
        reason: reason?.trim() || null,
      },
    });
    return res.status(201).json({ message: "Refund request submitted.", refund });
  } catch (err) {
    logger.error("requestRefund error:", err);
    return res.status(500).json({ error: "Failed to request refund." });
  }
}

async function processRefund(req, res) {
  try {
    const { refundId } = req.params;
    const { action, notes } = req.body;
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Action must be approve or reject." });
    }

    const refund = await prisma.paymentRefund.findUnique({
      where: { id: refundId },
      include: { payment: true },
    });
    if (!refund) return res.status(404).json({ error: "Refund request not found." });
    if (refund.status !== "REQUESTED") return res.status(409).json({ error: "Refund request is already processed." });

    if (action === "reject") {
      const rejected = await prisma.paymentRefund.update({
        where: { id: refundId },
        data: { status: "REJECTED", reason: notes || refund.reason, processedAt: new Date() },
      });
      return res.json({ message: "Refund rejected.", refund: rejected });
    }

    const { keyId, keySecret } = getRazorpayConfig();
    if (!refund.payment.razorpayPaymentId) return res.status(400).json({ error: "Missing Razorpay payment id." });

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch(`${RAZORPAY_API_BASE}/payments/${refund.payment.razorpayPaymentId}/refund`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: refund.amountPaise, notes: { refundId, reason: refund.reason || "" } }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error?.description || "Razorpay refund failed.");

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.paymentRefund.update({
        where: { id: refundId },
        data: { status: "PROCESSED", razorpayRefundId: data.id, processedAt: new Date() },
      });
      await tx.payment.update({ where: { id: refund.paymentId }, data: { status: "REFUNDED" } });
      return saved;
    });

    return res.json({ message: "Refund processed.", refund: updated });
  } catch (err) {
    logger.error("processRefund error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to process refund." });
  }
}

// POST /api/payments/webhook
async function handleRazorpayWebhook(req, res) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).json({ error: "Webhook secret is not configured." });
    }

    const signature = req.headers["x-razorpay-signature"];
    const eventId = req.headers["x-razorpay-event-id"];
    const rawBody = req.body;

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return res.status(400).json({ error: "Invalid webhook signature." });
    }

    if (eventId) {
      const existing = await prisma.paymentWebhookEvent.findUnique({ where: { eventId } });
      if (existing) return res.json({ ok: true, duplicate: true });
    }

    const event = JSON.parse(rawBody.toString("utf8"));
    const paymentEntity = event?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id || event?.payload?.order?.entity?.id;
    const paymentId = paymentEntity?.id;

    if (["payment.captured", "order.paid"].includes(event.event) && orderId) {
      const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: orderId } });
      if (payment && payment.status !== "PAID") {
        const result = await approveEnrollmentForPayment(payment, paymentId || payment.razorpayPaymentId, payment.razorpaySignature);
        await attemptRoutePayout(result.payment.id);
      }
    }

    if (eventId) {
      await prisma.paymentWebhookEvent.create({
        data: { eventId, eventType: event.event || "unknown" },
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error("handleRazorpayWebhook error:", err);
    return res.status(500).json({ error: "Webhook processing failed." });
  }
}

module.exports = {
  createCoursePaymentOrder,
  verifyCoursePayment,
  listMyPayments,
  requestRefund,
  processRefund,
  handleRazorpayWebhook,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  attemptRoutePayout,
  retryPayout,
};
