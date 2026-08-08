const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { requireParentalConsentIfMinor } = require("../middleware/ageGate.middleware");
const {
  createCoursePaymentOrder,
  verifyCoursePayment,
  listMyPayments,
  requestRefund,
  processRefund,
} = require("../controllers/payment.controller");

// Minors can browse/enroll for free content, but a real money
// transaction requires an APPROVED parent link first (DPDP Act 2023).
router.post(
  "/courses/:courseId/order",
  requireAuth,
  requireRole("STUDENT"),
  requireParentalConsentIfMinor,
  createCoursePaymentOrder
);
router.post("/verify", requireAuth, requireRole("STUDENT"), verifyCoursePayment);
router.get("/", requireAuth, listMyPayments);
router.post("/:paymentId/refund-request", requireAuth, requireRole("STUDENT"), requestRefund);
router.post("/refunds/:refundId/process", requireAuth, requireRole("ADMIN"), processRefund);

module.exports = router;
