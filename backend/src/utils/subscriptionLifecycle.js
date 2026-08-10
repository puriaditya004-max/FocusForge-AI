function getAccessEndsAt(subscription) {
  return subscription?.currentPeriodEnd || subscription?.trialEndsAt || null;
}

function getEffectiveSubscriptionStatus(subscription, now = new Date()) {
  if (!subscription) return "NONE";
  if (subscription.status === "CANCELLED") return "CANCELLED";

  const accessEndsAt = getAccessEndsAt(subscription);
  if (accessEndsAt && accessEndsAt < now) {
    if (subscription.graceEndsAt && subscription.graceEndsAt >= now) return "GRACE";
    return "EXPIRED";
  }

  return subscription.status;
}

function hasPremiumAccess(subscription, now = new Date()) {
  return ["ACTIVE", "TRIALING", "GRACE"].includes(getEffectiveSubscriptionStatus(subscription, now));
}

function formatAccessPayload(subscription) {
  return {
    status: getEffectiveSubscriptionStatus(subscription),
    storedStatus: subscription?.status || null,
    plan: subscription?.plan || null,
    accessEndsAt: getAccessEndsAt(subscription),
    trialEndsAt: subscription?.trialEndsAt || null,
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    graceEndsAt: subscription?.graceEndsAt || null,
  };
}

async function refreshSubscriptionLifecycle(prisma, subscription, now = new Date()) {
  if (!subscription) return subscription;

  const effectiveStatus = getEffectiveSubscriptionStatus(subscription, now);
  if (effectiveStatus !== "EXPIRED" || subscription.status === "EXPIRED") {
    return { ...subscription, effectiveStatus };
  }

  const expiredSubscription = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "EXPIRED" },
  });

  return { ...expiredSubscription, effectiveStatus: "EXPIRED" };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

module.exports = {
  addDays,
  getAccessEndsAt,
  getEffectiveSubscriptionStatus,
  hasPremiumAccess,
  formatAccessPayload,
  refreshSubscriptionLifecycle,
};
