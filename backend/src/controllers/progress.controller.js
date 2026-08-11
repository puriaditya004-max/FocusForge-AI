// ---------------------------------------------------------
// progress.controller.js — Aggregated analytics for the
// Progress page. Combines data from FocusSession, Task, and
// RoadmapItem tables into chart-ready shapes.
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");

const SUBJECT_COLORS = [
  "#a855f7",
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#eab308",
  "#ec4899",
  "#14b8a6",
  "#f43f5e",
];

// Returns an array of Date objects (midnight), oldest first, today last.
function getLastDays(count) {
  const days = [];
  for (let i = count - 1; i >= 0; i--) {
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

function deriveRoadmapTitle(items) {
  if (!items.length) return "No roadmap yet";
  const firstMonthLabel = items[0].monthLabel || "";
  const inferred = firstMonthLabel.replace(/\s+Month\s+\d+.*/i, "").split(":")[0]?.trim();
  return inferred || items[0].title || "Your roadmap";
}

// GET /api/progress/stats
const getStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const range = req.query.range === "month" ? "month" : "week";
    const dayCount = range === "month" ? 30 : 7;
    const days = getLastDays(dayCount);
    const rangeStart = days[0];

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const sessions = await prisma.focusSession.findMany({
      where: { userId, startedAt: { gte: rangeStart } },
    });

    const tasks = await prisma.task.findMany({
      where: { userId, date: { gte: rangeStart } },
    });

    // ---- Study hours + focus trend, per day ----
    const studyData = [];
    const focusTrendData = [];
    for (const day of days) {
      const daySessions = sessions.filter((s) => sameDay(new Date(s.startedAt), day));
      const totalSec = daySessions.reduce((sum, s) => sum + s.durationSec, 0);
      const hours = Math.round((totalSec / 3600) * 10) / 10;
      const avgFocus = daySessions.length
        ? Math.round(daySessions.reduce((sum, s) => sum + s.focusScore, 0) / daySessions.length)
        : 0;
      const label = dayLabel(day);
      studyData.push({ day: label, hours, goal: user.dailyGoalHours });
      focusTrendData.push({ day: label, focus: avgFocus });
    }

    // ---- Task completion, per day ----
    const taskCompletionData = days.map((day) => {
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
    const subjectDistribution = Object.entries(subjectTotals).map(([name, sec], index) => ({
      name,
      value: Math.round((sec / 3600) * 10) / 10,
      color: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
    }));

    // ---- Roadmap progress ----
    const roadmapItems = await prisma.roadmapItem.findMany({
      where: { userId },
      orderBy: { weekNumber: "asc" },
    });
    const totalWeeks = roadmapItems.length;
    const completedWeeks = roadmapItems.filter((r) => r.status === "COMPLETED").length;
    const currentWeek =
      roadmapItems.find((r) => r.status === "IN_PROGRESS")?.weekNumber ||
      (totalWeeks ? completedWeeks + 1 : 0);

    // ---- Totals ----
    const totalHours = Math.round(studyData.reduce((sum, d) => sum + d.hours, 0) * 10) / 10;
    const avgFocus = sessions.length
      ? Math.round(sessions.reduce((sum, s) => sum + s.focusScore, 0) / sessions.length)
      : 0;
    const totalCompleted = taskCompletionData.reduce((sum, d) => sum + d.completed, 0);
    const totalPending = taskCompletionData.reduce((sum, d) => sum + d.pending, 0);
    const periodGoalHours = (user.dailyGoalHours || 6) * dayCount;
    const periodGoalPercent =
      periodGoalHours > 0 ? Math.min(100, Math.round((totalHours / periodGoalHours) * 100)) : 0;

    res.status(200).json({
      range,
      dayCount,
      studyData,
      weeklyStudyData: studyData,
      focusTrendData,
      taskCompletionData,
      subjectDistribution,
      totalHours,
      periodGoalHours,
      periodGoalPercent,
      weeklyGoalHours: periodGoalHours,
      weeklyGoalPercent: periodGoalPercent,
      avgFocus,
      totalCompleted,
      totalPending,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      roadmap: {
        title: deriveRoadmapTitle(roadmapItems),
        hasRoadmap: totalWeeks > 0,
        completedWeeks,
        totalWeeks,
        currentWeek: totalWeeks > 0 ? Math.min(currentWeek, totalWeeks) : 0,
        percent: totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0,
      },
    });
  } catch (err) {
    logger.error("getStats error:", err);
    res.status(500).json({ message: "Failed to fetch progress stats" });
  }
};

module.exports = { getStats };
