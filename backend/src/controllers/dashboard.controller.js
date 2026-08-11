// ---------------------------------------------------------
// controllers/dashboard.controller.js
// Aggregates data from Task, FocusSession, and User tables
// to power the Dashboard page. No new DB tables needed.
// ---------------------------------------------------------

const prisma = require("../config/db");
const logger = require("../utils/logger");

function toDbPriority(p) {
  if (!p) return "MEDIUM";
  return p.toUpperCase();
}
function toFrontendPriority(p) {
  if (!p) return "Medium";
  return p.charAt(0) + p.slice(1).toLowerCase();
}

function formatScheduleTime(time, index) {
  if (time) return time;
  return `Task ${index + 1}`;
}

async function getDashboard(req, res) {
  try {
    const userId = req.user.userId;

    // --- Today's date range (start/end of today) ---
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // --- Today's tasks ---
    const todaysTasks = await prisma.task.findMany({
      where: {
        userId,
        date: { gte: startOfDay, lte: endOfDay },
      },
      include: { subtasks: true },
      orderBy: { createdAt: "asc" },
    });

    const tasksCompleted = todaysTasks.filter((t) => t.completed).length;
    const tasksTotal = todaysTasks.length;
    const progressPercent =
      tasksTotal === 0 ? 0 : Math.round((tasksCompleted / tasksTotal) * 100);

    // --- Today's focus sessions ---
    const todaysSessions = await prisma.focusSession.findMany({
      where: {
        userId,
        startedAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const totalStudySeconds = todaysSessions.reduce(
      (sum, s) => sum + (s.durationSec || 0),
      0
    );

    const avgFocusScore =
      todaysSessions.length === 0
        ? 0
        : Math.round(
            todaysSessions.reduce((sum, s) => sum + (s.focusScore || 0), 0) /
              todaysSessions.length
          );

    // --- User (for streak, goal hours) ---
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        currentStreak: true,
        level: true,
        dailyGoalHours: true,
      },
    });

    const scheduledTasks = [...todaysTasks].sort((a, b) => {
      const aTime = a.time || "";
      const bTime = b.time || "";
      const aHasTime = /^\d{1,2}:\d{2}/.test(aTime);
      const bHasTime = /^\d{1,2}:\d{2}/.test(bTime);
      if (aHasTime && bHasTime) return aTime.localeCompare(bTime);
      if (aHasTime) return -1;
      if (bHasTime) return 1;
      return a.createdAt - b.createdAt;
    });

    // --- Current task: first incomplete scheduled task for today ---
    const currentTaskRaw = scheduledTasks.find((t) => !t.completed) || null;
    const currentTaskId = currentTaskRaw?.id || null;

    const schedule = scheduledTasks
      .map((task, index) => ({
        id: task.id,
        time: formatScheduleTime(task.time, index),
        title: task.title,
        subject: task.category || "General",
        duration: task.duration || "",
        status: task.completed ? "completed" : task.id === currentTaskId ? "current" : "upcoming",
      }));

    let currentTask = null;
    if (currentTaskRaw) {
      const subTopics = currentTaskRaw.subtasks.map((st) => ({
        label: st.title,
        done: st.completed,
      }));
      const subtaskProgress =
        subTopics.length === 0
          ? currentTaskRaw.completed
            ? 100
            : 0
          : Math.round(
              (subTopics.filter((s) => s.done).length / subTopics.length) * 100
            );

      currentTask = {
        id: currentTaskRaw.id,
        title: currentTaskRaw.title,
        category: currentTaskRaw.category || "General",
        priority: toFrontendPriority(currentTaskRaw.priority),
        progress: subtaskProgress,
        subTopics,
      };
    }

    res.json({
      stats: {
        progressPercent,
        studyTimeSeconds: totalStudySeconds,
        dailyGoalHours: user?.dailyGoalHours || 12,
        tasksCompleted,
        tasksTotal,
        focusScore: avgFocusScore,
      },
      currentTask,
      schedule,
      user: {
        name: user?.name || "Student",
        streak: user?.currentStreak || 0,
        level: user?.level || 1,
      },
    });
  } catch (err) {
    logger.error("getDashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard data." });
  }
}

module.exports = { getDashboard };
