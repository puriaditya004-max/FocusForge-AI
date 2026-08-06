// ---------------------------------------------------------
// progress.controller.js — Aggregated analytics for the
// Progress page. Combines data from FocusSession, Task, and
// RoadmapItem tables into chart-ready shapes.
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");

const SUBJECT_COLORS = {
  "Python": "#a855f7",
  "DSA": "#3b82f6",
  "ML / AI": "#22c55e",
  "Projects": "#f97316",
  "Revision": "#eab308",
};

// Returns an array of 7 Date objects (midnight), oldest first, today last
function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

// GET /api/progress/stats
const getStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const last7Days = getLast7Days();
    const weekStart = last7Days[0];

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const sessions = await prisma.focusSession.findMany({
      where: { userId, startedAt: { gte: weekStart } },
    });

    const tasks = await prisma.task.findMany({
      where: { userId, date: { gte: weekStart } },
    });

    // ---- Study hours + focus trend, per day ----
    const weeklyStudyData = [];
    const focusTrendData = [];
    for (const day of last7Days) {
      const daySessions = sessions.filter((s) => sameDay(new Date(s.startedAt), day));
      const totalSec = daySessions.reduce((sum, s) => sum + s.durationSec, 0);
      const hours = Math.round((totalSec / 3600) * 10) / 10;
      const avgFocus = daySessions.length
        ? Math.round(daySessions.reduce((sum, s) => sum + s.focusScore, 0) / daySessions.length)
        : 0;
      const label = dayLabel(day);
      weeklyStudyData.push({ day: label, hours, goal: user.dailyGoalHours });
      focusTrendData.push({ day: label, focus: avgFocus });
    }

    // ---- Task completion, per day ----
    const taskCompletionData = last7Days.map((day) => {
      const dayTasks = tasks.filter((t) => sameDay(new Date(t.date), day));
      return {
        day: dayLabel(day),
        completed: dayTasks.filter((t) => t.completed).length,
        pending: dayTasks.filter((t) => !t.completed).length,
      };
    });

    // ---- Subject distribution (hours by subject, from focus sessions) ----
    const subjectTotals = {};
    for (const s of sessions) {
      const key = s.subject || "Other";
      subjectTotals[key] = (subjectTotals[key] || 0) + s.durationSec;
    }
    const subjectDistribution = Object.entries(subjectTotals).map(([name, sec]) => ({
      name,
      value: Math.round((sec / 3600) * 10) / 10,
      color: SUBJECT_COLORS[name] || "#6b7280",
    }));

    // ---- Roadmap progress ----
    const roadmapItems = await prisma.roadmapItem.findMany({ where: { userId } });
    const totalWeeks = roadmapItems.length || 25;
    const completedWeeks = roadmapItems.filter((r) => r.status === "COMPLETED").length;
    const currentWeek =
      roadmapItems.find((r) => r.status === "IN_PROGRESS")?.weekNumber ||
      completedWeeks + 1;

    // ---- Totals ----
    const totalHours = Math.round(weeklyStudyData.reduce((sum, d) => sum + d.hours, 0) * 10) / 10;
    const avgFocus = focusTrendData.length
      ? Math.round(focusTrendData.reduce((sum, d) => sum + d.focus, 0) / focusTrendData.length)
      : 0;
    const totalCompleted = taskCompletionData.reduce((sum, d) => sum + d.completed, 0);
    const totalPending = taskCompletionData.reduce((sum, d) => sum + d.pending, 0);
    const weeklyGoalHours = (user.dailyGoalHours || 6) * 7;
    const weeklyGoalPercent =
      weeklyGoalHours > 0 ? Math.min(100, Math.round((totalHours / weeklyGoalHours) * 100)) : 0;

    res.status(200).json({
      weeklyStudyData,
      focusTrendData,
      taskCompletionData,
      subjectDistribution,
      totalHours,
      weeklyGoalHours,
      weeklyGoalPercent,
      avgFocus,
      totalCompleted,
      totalPending,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      roadmap: {
        completedWeeks,
        totalWeeks,
        currentWeek: Math.min(currentWeek, totalWeeks),
        percent: totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0,
      },
    });
  } catch (err) {
    logger.error("getStats error:", err);
    res.status(500).json({ message: "Failed to fetch progress stats" });
  }
};

module.exports = { getStats };