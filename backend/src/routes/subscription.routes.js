const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth.middleware");
const { requireParentalConsentIfMinor } = require("../middleware/ageGate.middleware");
const { paymentLimiter } = require("../middleware/rateLimiter.middleware");
const {
  getMySubscription,
  listMySubscriptionPayments,
  startTrial,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  markSubscriptionPaymentFailed,
  cancelMySubscription,
} = require("../controllers/subscription.controller");

function requireStudentOrParent(req, res, next) {
  if (!["STUDENT", "PARENT"].includes(req.user?.role)) {
    return res.status(403).json({ error: "You don't have permission to do this." });
  }
  next();
}

function requireStudent(req, res, next) {
  if (req.user?.role !== "STUDENT") {
    return res.status(403).json({ error: "Only student accounts can start a trial." });
  }
  next();
}

function parentalConsentForStudentsOnly(req, res, next) {
  if (req.user?.role !== "STUDENT") return next();
  return requireParentalConsentIfMinor(req, res, next);
}

router.get("/me", requireAuth, requireStudentOrParent, getMySubscription);
router.get("/payments", requireAuth, requireStudentOrParent, listMySubscriptionPayments);
router.post("/trial", requireAuth, requireStudent, startTrial);
router.post(
  "/order",
  requireAuth,
  requireStudentOrParent,
  paymentLimiter,
  parentalConsentForStudentsOnly,
  createSubscriptionOrder
);
router.post("/verify", requireAuth, requireStudentOrParent, paymentLimiter, verifySubscriptionPayment);
router.post("/fail", requireAuth, requireStudentOrParent, paymentLimiter, markSubscriptionPaymentFailed);
router.post("/cancel", requireAuth, requireStudentOrParent, paymentLimiter, cancelMySubscription);

module.exports = router;
