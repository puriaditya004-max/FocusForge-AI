// ---------------------------------------------------------
// admin.controller.js — data for the Admin Panel UI.
// Everything here is read/aggregate work for ADMIN-only routes;
// the actual approve/reject actions live in verification.controller.js
// (teacher verification) and payment.controller.js (refunds) so the
// business logic + Razorpay calls stay in one place each.
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");
const {
  addDays,
  getAccessEndsAt,
  getEffectiveSubscriptionStatus,
} = require("../utils/subscriptionLifecycle");

const GRACE_DAYS = Number(process.env.SUBSCRIPTION_GRACE_DAYS || 3);

async function expireDueSubscriptions(now = new Date()) {
  await prisma.subscription.updateMany({
    where: {
      status: { in: ["ACTIVE", "TRIALING"] },
      OR: [
        { graceEndsAt: { lt: now } },
        { graceEndsAt: null, currentPeriodEnd: { lt: now } },
      ],
    },
    data: { status: "EXPIRED" },
  });
}

async function getAdminOverview(req, res) {
  try {
    await expireDueSubscriptions();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      usersByRole,
      pendingTeacherVerifications,
      pendingRefunds,
      pendingStudyRoomReports,
      paidAgg,
      refundedAgg,
      paidPaymentCount,
      activeDigitalIds,
      totalCourses,
      totalEnrollments,
      subscriptionsByStatus,
      subscriptionsByPlan,
      subscriptionsInGrace,
      activeFamilyLinkedStudents,
      subscriptionRevenueAgg,
      monthlySubscriptionRevenueAgg,
      paidSubscriptionPaymentCount,
      recentUsers,
      recentPayments,
      recentSubscriptionPayments,
      recentSubscriptions,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { role: true } }),
      prisma.teacherVerification.count({ where: { status: "PENDING" } }),
      prisma.paymentRefund.count({ where: { status: "REQUESTED" } }),
      prisma.studyRoomMessageReport.count({ where: { status: "PENDING" } }),
      prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amountPaise: true } }),
      prisma.paymentRefund.aggregate({ where: { status: "PROCESSED" }, _sum: { amountPaise: true } }),
      prisma.payment.count({ where: { status: "PAID" } }),
      prisma.digitalId.count({ where: { status: "ACTIVE" } }),
      prisma.course.count(),
      prisma.enrollment.count({ where: { status: "APPROVED" } }),
      prisma.subscription.groupBy({ by: ["status"], _count: { status: true } }),
      prisma.subscription.groupBy({ by: ["plan"], _count: { plan: true } }),
      prisma.subscription.count({
        where: {
          status: { in: ["ACTIVE", "TRIALING"] },
          currentPeriodEnd: { lt: new Date() },
          graceEndsAt: { gte: new Date() },
        },
      }),
      prisma.studentParentLink.count({
        where: {
          status: "APPROVED",
          parent: {
            subscription: {
              plan: "FAMILY",
              status: { in: ["ACTIVE", "TRIALING"] },
            },
          },
        },
      }),
      prisma.subscriptionPayment.aggregate({ where: { status: "PAID" }, _sum: { amountPaise: true } }),
      prisma.subscriptionPayment.aggregate({
        where: { status: "PAID", paidAt: { gte: monthStart } },
        _sum: { amountPaise: true },
      }),
      prisma.subscriptionPayment.count({ where: { status: "PAID" } }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          emailVerifiedAt: true,
          mobileVerifiedAt: true,
        },
      }),
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          amountPaise: true,
          platformFeePaise: true,
          teacherAmountPaise: true,
          createdAt: true,
          paidAt: true,
          course: { select: { title: true } },
          student: { select: { name: true, email: true } },
        },
      }),
      prisma.subscriptionPayment.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          plan: true,
          amountPaise: true,
          createdAt: true,
          paidAt: true,
          user: { select: { name: true, email: true, role: true } },
        },
      }),
      prisma.subscription.findMany({
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          id: true,
          plan: true,
          status: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
          graceEndsAt: true,
          updatedAt: true,
          user: { select: { name: true, email: true, role: true } },
        },
      }),
    ]);

    const roleCounts = { STUDENT: 0, PARENT: 0, TEACHER: 0, ADMIN: 0 };
    usersByRole.forEach((r) => {
      roleCounts[r.role] = r._count.role;
    });

    const subscriptionStatusCounts = { TRIALING: 0, ACTIVE: 0, EXPIRED: 0, CANCELLED: 0 };
    subscriptionsByStatus.forEach((s) => {
      subscriptionStatusCounts[s.status] = s._count.status;
    });

    const subscriptionPlanCounts = { TRIAL: 0, STUDENT_MONTHLY: 0, STUDENT_YEARLY: 0, FAMILY: 0 };
    subscriptionsByPlan.forEach((p) => {
      subscriptionPlanCounts[p.plan] = p._count.plan;
    });

    return res.json({
      users: {
        total: Object.values(roleCounts).reduce((a, b) => a + b, 0),
        byRole: roleCounts,
      },
      pendingTeacherVerifications,
      pendingRefunds,
      pendingStudyRoomReports,
      totalRevenuePaise: paidAgg._sum.amountPaise || 0,
      totalRefundedPaise: refundedAgg._sum.amountPaise || 0,
      netRevenuePaise: (paidAgg._sum.amountPaise || 0) - (refundedAgg._sum.amountPaise || 0),
      paidPaymentCount,
      activeDigitalIds,
      totalCourses,
      totalEnrollments,
      subscriptions: {
        byStatus: subscriptionStatusCounts,
        byPlan: subscriptionPlanCounts,
        inGrace: subscriptionsInGrace,
        activeOrTrialing: subscriptionStatusCounts.ACTIVE + subscriptionStatusCounts.TRIALING,
        familyLinkedStudents: activeFamilyLinkedStudents,
        totalRevenuePaise: subscriptionRevenueAgg._sum.amountPaise || 0,
        monthlyRevenuePaise: monthlySubscriptionRevenueAgg._sum.amountPaise || 0,
        paidPaymentCount: paidSubscriptionPaymentCount,
      },
      recentUsers,
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        status: p.status,
        amountPaise: p.amountPaise,
        platformFeePaise: p.platformFeePaise,
        teacherAmountPaise: p.teacherAmountPaise,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        courseTitle: p.course?.title || "Untitled course",
        studentName: p.student?.name || "Unknown student",
        studentEmail: p.student?.email || "",
      })),
      recentSubscriptionPayments: recentSubscriptionPayments.map((p) => ({
        id: p.id,
        status: p.status,
        plan: p.plan,
        amountPaise: p.amountPaise,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        userName: p.user?.name || "Unknown user",
        userEmail: p.user?.email || "",
        userRole: p.user?.role || "",
      })),
      recentSubscriptions: recentSubscriptions.map((s) => ({
        id: s.id,
        plan: s.plan,
        status: getEffectiveSubscriptionStatus(s),
        storedStatus: s.status,
        accessEndsAt: getAccessEndsAt(s),
        graceEndsAt: s.graceEndsAt,
        updatedAt: s.updatedAt,
        userName: s.user?.name || "Unknown user",
        userEmail: s.user?.email || "",
        userRole: s.user?.role || "",
      })),
    });
  } catch (err) {
    logger.error("getAdminOverview error:", err);
    return res.status(500).json({ error: "Failed to load admin overview." });
  }
}

async function listRefunds(req, res) {
  try {
    const status = req.query.status || "REQUESTED";
    const refunds = await prisma.paymentRefund.findMany({
      where: status === "ALL" ? {} : { status },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        payment: {
          select: {
            id: true,
            amountPaise: true,
            razorpayPaymentId: true,
            status: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ refunds });
  } catch (err) {
    logger.error("listRefunds error:", err);
    return res.status(500).json({ error: "Failed to load refund queue." });
  }
}

async function updateSubscriptionAccess(req, res) {
  try {
    const { id } = req.params;
    const action = String(req.body.action || "").toUpperCase();
    const subscription = await prisma.subscription.findUnique({ where: { id } });
    if (!subscription) return res.status(404).json({ error: "Subscription not found." });

    if (action === "CANCEL") {
      const now = new Date();
      const cancelled = await prisma.subscription.update({
        where: { id },
        data: {
          status: "CANCELLED",
          currentPeriodEnd: now,
          graceEndsAt: now,
        },
      });
      return res.json({ message: "Subscription cancelled.", subscription: cancelled });
    }

    if (action === "EXTEND") {
      const days = Number(req.body.days);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return res.status(400).json({ error: "Extension days must be between 1 and 365." });
      }

      const now = new Date();
      const accessEndsAt = getAccessEndsAt(subscription);
      const baseDate = accessEndsAt && accessEndsAt > now ? accessEndsAt : now;
      const currentPeriodEnd = addDays(baseDate, days);
      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: "ACTIVE",
          currentPeriodStart: subscription.currentPeriodStart || now,
          currentPeriodEnd,
          graceEndsAt: addDays(currentPeriodEnd, GRACE_DAYS),
        },
      });
      return res.json({ message: `Subscription extended by ${days} days.`, subscription: updated });
    }

    return res.status(400).json({ error: "Choose a valid subscription action." });
  } catch (err) {
    logger.error("updateSubscriptionAccess error:", err);
    return res.status(500).json({ error: "Failed to update subscription." });
  }
}

async function listStudyRoomReports(req, res) {
  try {
    const status = req.query.status || "PENDING";
    const reports = await prisma.studyRoomMessageReport.findMany({
      where: status === "ALL" ? {} : { status },
      include: {
        reportedBy: { select: { id: true, name: true, email: true } },
        message: {
          select: {
            id: true, message: true, isDeleted: true, createdAt: true, roomId: true,
            user: { select: { id: true, name: true, email: true } },
            room: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ reports });
  } catch (err) {
    logger.error("listStudyRoomReports error:", err);
    return res.status(500).json({ error: "Failed to load report queue." });
  }
}

// action: "delete" removes the reported message (soft delete) and marks
// the report MESSAGE_DELETED. "dismiss" leaves the message as-is.
async function resolveStudyRoomReport(req, res) {
  try {
    const { id } = req.params;
    const { action } = req.body;
    if (!["delete", "dismiss"].includes(action)) {
      return res.status(400).json({ error: "Action must be delete or dismiss." });
    }

    const report = await prisma.studyRoomMessageReport.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: "Report not found." });
    if (report.status !== "PENDING") return res.status(409).json({ error: "Report already resolved." });

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      if (action === "delete") {
        await tx.studyRoomMessage.update({
          where: { id: report.messageId },
          data: { isDeleted: true, deletedAt: now },
        });
      }
      return tx.studyRoomMessageReport.update({
        where: { id },
        data: {
          status: action === "delete" ? "MESSAGE_DELETED" : "DISMISSED",
          resolvedById: req.user.userId,
          resolvedAt: now,
        },
      });
    });

    return res.json({ message: "Report resolved.", report: updated });
  } catch (err) {
    logger.error("resolveStudyRoomReport error:", err);
    return res.status(500).json({ error: "Failed to resolve report." });
  }
}

// GET /api/admin/payouts?status=FAILED
// ADMIN — every PAID payment, filterable by payoutStatus, so an
// admin can see which teacher payouts are stuck (NOT_READY —
// teacher hasn't linked a Route account yet; FAILED — a transfer
// attempt errored; PAID_OUT — done) and retry from the UI.
async function listPayouts(req, res) {
  try {
    const status = req.query.status || "ALL";
    const payments = await prisma.payment.findMany({
      where: { status: "PAID", ...(status === "ALL" ? {} : { payoutStatus: status }) },
      include: {
        student: { select: { name: true } },
        course: { select: { title: true, teacher: { select: { name: true, razorpayRouteAccountId: true } } } },
      },
      orderBy: { paidAt: "desc" },
      take: 200,
    });
    return res.json({ payments });
  } catch (err) {
    logger.error("listPayouts error:", err);
    return res.status(500).json({ error: "Failed to load payouts." });
  }
}

module.exports = {
  getAdminOverview,
  updateSubscriptionAccess,
  listRefunds,
  listStudyRoomReports,
  resolveStudyRoomReport,
  listPayouts,
};
