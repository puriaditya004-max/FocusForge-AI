const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const {
  createCoursePaymentOrder,
  verifyCoursePayment,
  listMyPayments,
  requestRefund,
  processRefund,
} = require("../controllers/payment.controller");

router.post("/courses/:courseId/order", requireAuth, requireRole("STUDENT"), createCoursePaymentOrder);
router.post("/verify", requireAuth, requireRole("STUDENT"), verifyCoursePayment);
router.get("/", requireAuth, listMyPayments);
router.post("/:paymentId/refund-request", requireAuth, requireRole("STUDENT"), requestRefund);
router.post("/refunds/:refundId/process", requireAuth, requireRole("ADMIN"), processRefund);

module.exports = router;
