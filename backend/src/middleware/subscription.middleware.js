const prisma = require("../config/db");

function getAccessEndsAt(subscription) {
  return subscription?.currentPeriodEnd || subscription?.trialEndsAt || null;
}

function getEffectiveSubscriptionStatus(subscription) {
  if (!subscription) return "NONE";
  if (subscription.status === "CANCELLED") return "CANCELLED";

  const now = new Date();
  const accessEndsAt = getAccessEndsAt(subscription);
  if (accessEndsAt && accessEndsAt < now) {
    if (subscription.graceEndsAt && subscription.graceEndsAt >= now) return "GRACE";
    return "EXPIRED";
  }

  return subscription.status;
}

function hasPremiumAccess(subscription) {
  return ["ACTIVE", "TRIALING", "GRACE"].includes(getEffectiveSubscriptionStatus(subscription));
}

function formatAccessPayload(subscription) {
  return {
    status: getEffectiveSubscriptionStatus(subscription),
    plan: subscription?.plan || null,
    accessEndsAt: getAccessEndsAt(subscription),
    trialEndsAt: subscription?.trialEndsAt || null,
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    graceEndsAt: subscription?.graceEndsAt || null,
  };
}

async function requirePremiumAccess(req, res, next) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated. Please log in." });
    }

    if (process.env.NODE_ENV === "test" && !prisma.subscription) {
      return next();
    }

    const ownSubscription = await prisma.subscription.findUnique({ where: { userId } });
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
      subscription = familyLink?.parent?.subscription || ownSubscription;
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
