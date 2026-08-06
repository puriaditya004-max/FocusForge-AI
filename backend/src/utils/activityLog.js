// ---------------------------------------------------------
// activityLog.js — tiny shared helper to write a row into
// ActivityLog. Called from wherever XP is already being
// awarded/deducted or something notable happens (badge unlock,
// challenge completed, task completed, penalty applied), so
// the Rewards page "Recent Activity" feed never drifts from
// what actually happened in the other controllers.
//
// Deliberately fire-and-forget-ish: a logging failure should
// never break the actual action (completing a task, unlocking
// a badge, etc.), so callers can await it but errors are caught
// and logged here rather than bubbled up.
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");

/**
 * @param {string} userId
 * @param {{ icon?: string, text: string, xp?: number }} entry
 */
async function logActivity(userId, { icon = "⭐", text, xp = 0 }) {
  try {
    await prisma.activityLog.create({
      data: { userId, icon, text, xp },
    });
  } catch (err) {
    logger.error("logActivity error:", err);
    // Intentionally swallowed — logging the activity feed is
    // never allowed to fail the caller's real action.
  }
}

// GET helper — most recent N entries for a user, newest first.
async function getRecentActivity(userId, limit = 8) {
  const rows = await prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    icon: r.icon,
    text: r.text,
    xp: r.xp >= 0 ? `+${r.xp} XP` : `${r.xp} XP`,
    time: r.createdAt,
  }));
}

module.exports = { logActivity, getRecentActivity };