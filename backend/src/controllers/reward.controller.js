// ---------------------------------------------------------
// reward.controller.js — XP, Levels, Badges, Daily Challenges
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");
const { logActivity, getRecentActivity } = require("../utils/activityLog");

const XP_PER_LEVEL = 500;

const BADGE_DEFS = [
  { code: "FIRST_LAUNCH", icon: "🚀", title: "First Launch", desc: "Completed Day 1", xpReward: 50 },
  { code: "ON_FIRE", icon: "🔥", title: "On Fire", desc: "7-day streak", xpReward: 100 },
  { code: "TASK_CRUSHER", icon: "✅", title: "Task Crusher", desc: "Completed 10 tasks in a day", xpReward: 150 },
  { code: "DEEP_THINKER", icon: "🧠", title: "Deep Thinker", desc: "90%+ focus score for 3 days", xpReward: 200 },
  { code: "BUILDER", icon: "🏗️", title: "Builder", desc: "Completed first weekly project", xpReward: 250 },
  { code: "BOOKWORM", icon: "📚", title: "Bookworm", desc: "Studied 7+ hours in a day", xpReward: 200 },
  { code: "SPEED_RUNNER", icon: "⚡", title: "Speed Runner", desc: "Finished all tasks before 6 PM", xpReward: 150 },
  { code: "SNIPER", icon: "🎯", title: "Sniper", desc: "100% daily progress for 5 days", xpReward: 300 },
  { code: "NIGHT_OWL", icon: "🌙", title: "Night Owl", desc: "Completed revision at night 3x", xpReward: 100 },
  { code: "COMEBACK_KID", icon: "💪", title: "Comeback Kid", desc: "Resumed after missing a day", xpReward: 150 },
  { code: "AI_PADAWAN", icon: "🤖", title: "AI Padawan", desc: "Used AI Mentor 10 times", xpReward: 100 },
  { code: "MONTH_CHAMPION", icon: "🏆", title: "Month Champion", desc: "Completed Month 1 roadmap", xpReward: 500 },
];

const DAILY_CHALLENGE_TEMPLATES = [
  { title: "Complete all High priority tasks today", xp: 50 },
  { title: "Maintain 85%+ focus score", xp: 30 },
  { title: "Study for at least 6 hours", xp: 40 },
];

const STREAK_MILESTONES = [
  { days: 7, label: "Week Warrior", icon: "🥉", color: "from-orange-700 to-amber-600" },
  { days: 14, label: "Fortnight Focus", icon: "🥈", color: "from-slate-400 to-gray-300" },
  { days: 21, label: "21 Day Legend", icon: "🥇", color: "from-yellow-500 to-amber-400" },
  { days: 50, label: "Unstoppable", icon: "💎", color: "from-cyan-500 to-blue-400" },
  { days: 100, label: "100 Day Master", icon: "👑", color: "from-purple-500 to-violet-400" },
];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function ensureBadgesSeeded() {
  for (const b of BADGE_DEFS) {
    await prisma.badge.upsert({
      where: { code: b.code },
      update: {},
      create: b,
    });
  }
}

async function ensureTodayChallenges(userId) {
  const today = startOfToday();
  const existing = await prisma.dailyChallenge.findMany({
    where: { userId, date: today },
  });
  if (existing.length === 0) {
    await prisma.dailyChallenge.createMany({
      data: DAILY_CHALLENGE_TEMPLATES.map((c) => ({
        userId,
        title: c.title,
        xp: c.xp,
        date: today,
      })),
    });
  }
}

async function addXp(userId, amount) {
  const current = await prisma.user.findUnique({ where: { id: userId } });
  const safeAmount =
    amount < 0 ? -Math.min(Math.abs(amount), current.xp) : amount;

  const user = await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: safeAmount } },
  });
  const newLevel = Math.max(1, Math.floor(user.xp / XP_PER_LEVEL) + 1);
  if (newLevel !== user.level) {
    await prisma.user.update({ where: { id: userId }, data: { level: newLevel } });
  }
}

async function checkAndUnlockBadges(userId) {
  const alreadyUnlocked = await prisma.userBadge.findMany({
    where: { userId },
    select: { badge: { select: { code: true } } },
  });
  const unlockedCodes = new Set(alreadyUnlocked.map((u) => u.badge.code));

  const toUnlock = [];

  if (!unlockedCodes.has("FIRST_LAUNCH")) {
    const count = await prisma.task.count({ where: { userId, completed: true } });
    if (count >= 1) toUnlock.push("FIRST_LAUNCH");
  }

  if (!unlockedCodes.has("ON_FIRE")) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.currentStreak >= 7) toUnlock.push("ON_FIRE");
  }

  if (!unlockedCodes.has("TASK_CRUSHER")) {
    const tasks = await prisma.task.findMany({
      where: { userId, completed: true },
      select: { date: true },
    });
    const perDay = {};
    for (const t of tasks) {
      const key = new Date(t.date).toDateString();
      perDay[key] = (perDay[key] || 0) + 1;
    }
    if (Object.values(perDay).some((n) => n >= 10)) toUnlock.push("TASK_CRUSHER");
  }

  if (!unlockedCodes.has("BOOKWORM")) {
    const sessions = await prisma.focusSession.findMany({
      where: { userId },
      select: { startedAt: true, durationSec: true },
    });
    const perDay = {};
    for (const s of sessions) {
      const key = new Date(s.startedAt).toDateString();
      perDay[key] = (perDay[key] || 0) + s.durationSec;
    }
    if (Object.values(perDay).some((sec) => sec >= 7 * 3600)) toUnlock.push("BOOKWORM");
  }

  if (!unlockedCodes.has("MONTH_CHAMPION")) {
    const month1Items = await prisma.roadmapItem.findMany({
      where: { userId, monthNumber: 1 },
    });
    if (month1Items.length > 0 && month1Items.every((i) => i.status === "COMPLETED")) {
      toUnlock.push("MONTH_CHAMPION");
    }
  }

  for (const code of toUnlock) {
    const badge = await prisma.badge.findUnique({ where: { code } });
    if (!badge) continue;
    await prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
    await addXp(userId, badge.xpReward);
    await logActivity(userId, {
      icon: badge.icon,
      text: `${badge.title} badge unlocked`,
      xp: badge.xpReward,
    });
  }
}

async function buildCertificateEligibility(userId) {
  const monthItems = await prisma.roadmapItem.findMany({
    where: { userId, monthNumber: 1 },
    orderBy: { weekNumber: "asc" },
  });

  const completedItems = monthItems.filter((item) => item.status === "COMPLETED").length;
  const roadmapPercent = monthItems.length
    ? Math.round((completedItems / monthItems.length) * 100)
    : 0;
  const candidates = monthItems.flatMap((item) => [
    item.monthLabel?.replace(/\s+Month\s+\d+.*/i, "").split(":")[0]?.trim(),
    item.monthLabel,
    item.title,
  ]);
  const baseTopic =
    candidates
      .map((candidate) =>
        String(candidate || "")
          .replace(/\s+/g, " ")
          .replace(/\s+-\s+Month\s+\d+.*/i, "")
          .replace(/\s+Month\s+\d+.*/i, "")
          .trim()
      )
      .find((candidate) => candidate && candidate.length >= 3) ||
    "Your Month 1 roadmap";
  const topic = `${baseTopic} - Month 1`;

  const certificate = await prisma.certificate.findFirst({
    where: { userId, title: topic },
    orderBy: { issuedAt: "desc" },
  });

  return {
    topic,
    roadmapPercent,
    completedItems,
    totalItems: monthItems.length,
    roadmapComplete: monthItems.length > 0 && completedItems === monthItems.length,
    projectEvidenceRequired: true,
    passScoreRequired: 97,
    maxAttempts: 2,
    certificateEarned: !!certificate,
    certificate: certificate
      ? {
          id: certificate.id,
          certificateCode: certificate.certificateCode,
          title: certificate.title,
          score: certificate.score,
          issuedAt: certificate.issuedAt,
        }
      : null,
    eligible: monthItems.length > 0 && completedItems === monthItems.length && !certificate,
  };
}

// GET /api/rewards
const getRewards = async (req, res) => {
  try {
    const userId = req.user.userId;

    await ensureBadgesSeeded();
    await checkAndUnlockBadges(userId);
    await ensureTodayChallenges(userId);

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const allBadges = await prisma.badge.findMany({ orderBy: { xpReward: "asc" } });
    const userBadges = await prisma.userBadge.findMany({ where: { userId } });
    const unlockedBadgeIds = new Set(userBadges.map((ub) => ub.badgeId));

    const badges = allBadges.map((b) => ({
      id: b.id,
      icon: b.icon,
      title: b.title,
      desc: b.desc,
      xp: b.xpReward,
      unlocked: unlockedBadgeIds.has(b.id),
    }));

    const today = startOfToday();
    const challenges = await prisma.dailyChallenge.findMany({
      where: { userId, date: today },
      orderBy: { id: "asc" },
    });

    const recentActivity = await getRecentActivity(userId, 8);
    const certificateEligibility = await buildCertificateEligibility(userId);
    const streakMilestones = STREAK_MILESTONES.map((milestone) => ({
      ...milestone,
      unlocked: user.currentStreak >= milestone.days,
      daysRemaining: Math.max(0, milestone.days - user.currentStreak),
    }));

    res.status(200).json({
      totalXP: user.xp,
      xpPerLevel: XP_PER_LEVEL,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      streakMilestones,
      badges,
      challenges: challenges.map((c) => ({
        id: c.id,
        title: c.title,
        xp: c.xp,
        done: c.done,
      })),
      recentActivity,
      certificateEligibility,
    });
  } catch (err) {
    logger.error("getRewards error:", err);
    res.status(500).json({ message: "Failed to fetch rewards" });
  }
};

// PATCH /api/rewards/challenges/:id/toggle
const toggleChallenge = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const existing = await prisma.dailyChallenge.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ message: "Challenge not found" });
    }

    const newDone = !existing.done;

    const updated = await prisma.dailyChallenge.update({
      where: { id },
      data: { done: newDone },
    });

    await addXp(userId, newDone ? existing.xp : -existing.xp);

    if (newDone) {
      await logActivity(userId, {
        icon: "⭐",
        text: `Completed daily challenge: ${existing.title}`,
        xp: existing.xp,
      });
    }

    res.status(200).json({
      id: updated.id,
      title: updated.title,
      xp: updated.xp,
      done: updated.done,
    });
  } catch (err) {
    logger.error("toggleChallenge error:", err);
    res.status(500).json({ message: "Failed to update challenge" });
  }
};

module.exports = {
  getRewards,
  toggleChallenge,
};
