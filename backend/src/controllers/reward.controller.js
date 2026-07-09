// ---------------------------------------------------------
// reward.controller.js — XP, Levels, Badges, Daily Challenges
// ---------------------------------------------------------
// XP_PER_LEVEL matches the frontend constant (500 XP/level).
// User.xp stores TOTAL cumulative XP; level is derived from
// it, not stored separately, to avoid the two getting out of
// sync.
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");

const XP_PER_LEVEL = 500;

// Master badge list — seeded into the (global, shared) Badge
// table once. Unlock conditions are checked lazily whenever
// a user opens the Rewards page.
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

// Fixed daily challenge templates — same 3 every day for now.
const DAILY_CHALLENGE_TEMPLATES = [
  { title: "Complete all High priority tasks today", xp: 50 },
  { title: "Maintain 85%+ focus score", xp: 30 },
  { title: "Study for at least 6 hours", xp: 40 },
];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Make sure the global Badge table has all master badges
async function ensureBadgesSeeded() {
  for (const b of BADGE_DEFS) {
    await prisma.badge.upsert({
      where: { code: b.code },
      update: {},
      create: b,
    });
  }
}

// Make sure today's daily challenges exist for this user
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

// Award XP to a user and keep the `level` field in sync.
// XP is never allowed to drop below 0 (e.g. un-checking a
// challenge shouldn't be able to push a user's total negative).
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

// Checks simple, computable badge conditions and unlocks any
// that are newly satisfied. Badges that depend on features not
// built yet (AI Mentor, exact "before 6 PM" timestamps, etc.)
// are left locked for now — they just won't unlock, no crash.
async function checkAndUnlockBadges(userId) {
  const alreadyUnlocked = await prisma.userBadge.findMany({
    where: { userId },
    select: { badge: { select: { code: true } } },
  });
  const unlockedCodes = new Set(alreadyUnlocked.map((u) => u.badge.code));

  const toUnlock = [];

  // FIRST_LAUNCH — completed at least 1 task ever
  if (!unlockedCodes.has("FIRST_LAUNCH")) {
    const count = await prisma.task.count({ where: { userId, completed: true } });
    if (count >= 1) toUnlock.push("FIRST_LAUNCH");
  }

  // ON_FIRE — current streak >= 7
  if (!unlockedCodes.has("ON_FIRE")) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.currentStreak >= 7) toUnlock.push("ON_FIRE");
  }

  // TASK_CRUSHER — 10+ tasks completed on the same day
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

  // BOOKWORM — 7+ hours of focus sessions in a single day
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

  // MONTH_CHAMPION — all Month 1 roadmap weeks completed
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
  }
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

    res.status(200).json({
      totalXP: user.xp,
      xpPerLevel: XP_PER_LEVEL,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      badges,
      challenges: challenges.map((c) => ({
        id: c.id,
        title: c.title,
        xp: c.xp,
        done: c.done,
      })),
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

    // Award XP when marking done, remove it if un-checking by mistake
    await addXp(userId, newDone ? existing.xp : -existing.xp);

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