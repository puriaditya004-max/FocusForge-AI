const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth.middleware");
const { requireParentalConsentIfMinor } = require("../middleware/ageGate.middleware");
const {
  getMySubscription,
  startTrial,
  createSubscriptionOrder,
  verifySubscriptionPayment,
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
router.post("/trial", requireAuth, requireStudent, startTrial);
router.post(
  "/order",
  requireAuth,
  requireStudentOrParent,
  parentalConsentForStudentsOnly,
  createSubscriptionOrder
);
router.post("/verify", requireAuth, requireStudentOrParent, verifySubscriptionPayment);

module.exports = router;
