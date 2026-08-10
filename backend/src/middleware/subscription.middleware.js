const prisma = require("../config/db");
const {
  getEffectiveSubscriptionStatus,
  hasPremiumAccess,
  formatAccessPayload,
  refreshSubscriptionLifecycle,
} = require("../utils/subscriptionLifecycle");

async function requirePremiumAccess(req, res, next) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated. Please log in." });
    }

    if (process.env.NODE_ENV === "test" && !prisma.subscription) {
      return next();
    }

    const ownSubscription = await refreshSubscriptionLifecycle(
      prisma,
      await prisma.subscription.findUnique({ where: { userId } })
    );
    let subscription = ownSubscription;

    if (!hasPremiumAccess(subscription)) {
      const familyLink = await prisma.studentParentLink.findFirst({
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
        include: { parent: { include: { subscription: true } } },
        orderBy: { connectedAt: "asc" },
      });
      subscription = await refreshSubscriptionLifecycle(prisma, familyLink?.parent?.subscription) || ownSubscription;
    }

    if (!hasPremiumAccess(subscription)) {
      return res.status(402).json({
        code: "SUBSCRIPTION_REQUIRED",
        error: "Start your free trial or activate a subscription to use this premium feature.",
        subscription: formatAccessPayload(subscription),
      });
    }

    req.subscription = subscription;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getEffectiveSubscriptionStatus,
  hasPremiumAccess,
  requirePremiumAccess,
};
