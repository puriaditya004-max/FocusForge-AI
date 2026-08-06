// ---------------------------------------------------------
// admin.controller.js — data for the Admin Panel UI.
// Everything here is read/aggregate work for ADMIN-only routes;
// the actual approve/reject actions live in verification.controller.js
// (teacher verification) and payment.controller.js (refunds) so the
// business logic + Razorpay calls stay in one place each.
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");

async function getAdminOverview(req, res) {
  try {
    const [
      usersByRole,
      pendingTeacherVerifications,
      pendingRefunds,
      pendingStudyRoomReports,
      paidAgg,
      refundedAgg,
      totalCourses,
      totalEnrollments,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { role: true } }),
      prisma.teacherVerification.count({ where: { status: "PENDING" } }),
      prisma.paymentRefund.count({ where: { status: "REQUESTED" } }),
      prisma.studyRoomMessageReport.count({ where: { status: "PENDING" } }),
      prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amountPaise: true } }),
      prisma.paymentRefund.aggregate({ where: { status: "PROCESSED" }, _sum: { amountPaise: true } }),
      prisma.course.count(),
      prisma.enrollment.count({ where: { status: "APPROVED" } }),
    ]);

    const roleCounts = { STUDENT: 0, PARENT: 0, TEACHER: 0, ADMIN: 0 };
    usersByRole.forEach((r) => {
      roleCounts[r.role] = r._count.role;
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
      totalCourses,
      totalEnrollments,
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

module.exports = { getAdminOverview, listRefunds, listStudyRoomReports, resolveStudyRoomReport, listPayouts };
