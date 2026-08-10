const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { requireParentalConsentIfMinor } = require("../middleware/ageGate.middleware");
const {
  getMySubscription,
  startTrial,
  createSubscriptionOrder,
  verifySubscriptionPayment,
} = require("../controllers/subscription.controller");

router.get("/me", requireAuth, requireRole("STUDENT"), getMySubscription);
router.post("/trial", requireAuth, requireRole("STUDENT"), startTrial);
router.post(
  "/order",
  requireAuth,
  requireRole("STUDENT"),
  requireParentalConsentIfMinor,
  createSubscriptionOrder
);
router.post("/verify", requireAuth, requireRole("STUDENT"), verifySubscriptionPayment);

module.exports = router;
