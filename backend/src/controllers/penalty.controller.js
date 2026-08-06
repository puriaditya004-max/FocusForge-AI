// ---------------------------------------------------------
// penalty.controller.js — Strike / Penalty system
// ---------------------------------------------------------
// Automatic penalty creation is checked lazily whenever the
// student opens the Penalties page — same lazy-check pattern
// as checkAndUnlockBadges() in reward.controller.js. Three
// simple, heuristic rules (documented inline below); nothing
// fancy, and each rule uses PenaltyEvent.sourceId to avoid
// ever creating a duplicate for the same task/session/streak
// break.
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");
const { logActivity } = require("../utils/activityLog");

const LOOKBACK_DAYS = 14; // don't scan a student's entire history on every page load
const LOW_FOCUS_THRESHOLD = 40; // focusScore below this counts as "low focus"

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Rule 1 — MISSED_TASK (yellow): a task whose date is before today
// and is still not completed. One penalty per task, ever — sourceId
// is the task id, so re-running this never double-penalizes it.
async function detectMissedTasks(userId) {
  const today = startOfToday();
  const since = daysAgo(LOOKBACK_DAYS);

  const missed = await prisma.task.findMany({
    where: { userId, completed: false, date: { gte: since, lt: today } },
  });
  if (missed.length === 0) return;

  const already = await prisma.penaltyEvent.findMany({
    where: { userId, type: "MISSED_TASK", sourceId: { in: missed.map((t) => t.id) } },
    select: { sourceId: true },
  });
  const alreadyIds = new Set(already.map((e) => e.sourceId));

  for (const task of missed) {
    if (alreadyIds.has(task.id)) continue;
    const xp = 5;
    await prisma.penaltyEvent.create({
      data: {
        userId,
        type: "MISSED_TASK",
        severity: "YELLOW",
        title: `Missed task: "${task.title}"`,
        xpDeducted: xp,
        sourceId: task.id,
      },
    });
    await logActivity(userId, { icon: "⚠️", text: `Penalty: missed task "${task.title}"`, xp: -xp });
  }
}

// Rule 2 — LOW_FOCUS (orange): a completed focus session with
// focusScore below LOW_FOCUS_THRESHOLD. One penalty per session.
async function detectLowFocusSessions(userId) {
  const since = daysAgo(LOOKBACK_DAYS);

  const lowSessions = await prisma.focusSession.findMany({
    where: {
      userId,
      endedAt: { not: null },
      focusScore: { lt: LOW_FOCUS_THRESHOLD },
      startedAt: { gte: since },
    },
  });
  if (lowSessions.length === 0) return;

  const already = await prisma.penaltyEvent.findMany({
    where: { userId, type: "LOW_FOCUS", sourceId: { in: lowSessions.map((s) => s.id) } },
    select: { sourceId: true },
  });
  const alreadyIds = new Set(already.map((e) => e.sourceId));

  for (const session of lowSessions) {
    if (alreadyIds.has(session.id)) continue;
    const xp = 10;
    await prisma.penaltyEvent.create({
      data: {
        userId,
        type: "LOW_FOCUS",
        severity: "ORANGE",
        title: `Low focus session (${session.focusScore}%)${session.subject ? ` — ${session.subject}` : ""}`,
        xpDeducted: xp,
        sourceId: session.id,
      },
    });
    await logActivity(userId, { icon: "⚠️", text: `Penalty: low focus session (${session.focusScore}%)`, xp: -xp });
  }
}

// Rule 3 — STREAK_BREAK (red): the student's streak has reset to 0
// after they'd actually built one up (longestStreak > 0), and
// there isn't already an unresolved streak-break penalty sitting
// there. sourceId is the fixed string "streak".
async function detectStreakBreak(userId, user) {
  if (user.currentStreak !== 0 || user.longestStreak <= 0) return;

  const existingUnresolved = await prisma.penaltyEvent.findFirst({
    where: { userId, type: "STREAK_BREAK", sourceId: "streak", resolved: false },
  });
  if (existingUnresolved) return;

  const xp = 20;
  await prisma.penaltyEvent.create({
    data: {
      userId,
      type: "STREAK_BREAK",
      severity: "RED",
      title: `Streak broken — was at ${user.longestStreak} day(s)`,
      xpDeducted: xp,
      sourceId: "streak",
    },
  });
  await logActivity(userId, { icon: "🔥", text: "Penalty: streak broken", xp: -xp });
}

async function detectAndCreatePenalties(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  await detectMissedTasks(userId);
  await detectLowFocusSessions(userId);
  await detectStreakBreak(userId, user);
}

// Fixed redemption challenges — static data, no DB table needed
const REDEMPTION_CHALLENGES = [
  {
    id: 1,
    title: "Complete tomorrow's full task list with 90%+ focus score",
    reward: "Clears 1 penalty + refunds 20 XP",
    forSeverity: "orange",
  },
  {
    id: 2,
    title: "Study 3 days in a row without missing a single task",
    reward: "Clears streak_break penalty + restores partial streak",
    forSeverity: "red",
  },
];

const formatEvent = (e) => ({
  id: e.id,
  date: new Date(e.date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
  type: e.type.toLowerCase(),
  title: e.title,
  severity: e.severity.toLowerCase(),
  xpDeducted: e.xpDeducted,
  resolved: e.resolved,
  redemptionDone: e.redemptionDone,
});

// GET /api/penalties
const getPenalties = async (req, res) => {
  try {
    const userId = req.user.userId;

    await detectAndCreatePenalties(userId);

    const [events, user] = await Promise.all([
      prisma.penaltyEvent.findMany({ where: { userId }, orderBy: { date: "desc" } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    const unresolved = events.filter((e) => !e.resolved);

    let strikeLevel = "none";
    if (unresolved.some((e) => e.severity === "RED")) strikeLevel = "red";
    else if (unresolved.some((e) => e.severity === "ORANGE")) strikeLevel = "orange";
    else if (unresolved.some((e) => e.severity === "YELLOW")) strikeLevel = "yellow";

    const strikeCount = unresolved.length;
    const totalXpDeducted = events.reduce((sum, e) => sum + e.xpDeducted, 0);

    res.status(200).json({
      events: events.map(formatEvent),
      strikeLevel,
      strikeCount,
      totalXpDeducted,
      currentStreak: user?.currentStreak ?? 0,
      redemptionChallenges: REDEMPTION_CHALLENGES,
    });
  } catch (err) {
    logger.error("getPenalties error:", err);
    res.status(500).json({ message: "Failed to fetch penalties" });
  }
};

// PATCH /api/penalties/:id/redeem
const markRedeemed = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const existing = await prisma.penaltyEvent.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ message: "Penalty event not found" });
    }

    const updated = await prisma.penaltyEvent.update({
      where: { id },
      data: { resolved: true, redemptionDone: true },
    });

    res.status(200).json(formatEvent(updated));
  } catch (err) {
    logger.error("markRedeemed error:", err);
    res.status(500).json({ message: "Failed to update penalty event" });
  }
};

module.exports = {
  getPenalties,
  markRedeemed,
};