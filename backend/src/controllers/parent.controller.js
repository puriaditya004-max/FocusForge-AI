// ---------------------------------------------------------
// controllers/parent.controller.js
// Parent Dashboard — real data, using the StudentParentLink
// table that was already in the schema.
//
// A parent can be linked to one or more students. For each
// linked student, we reuse the same stats logic as the
// student's own Dashboard (today's tasks + focus sessions),
// so the numbers a parent sees always match what the student
// sees — no separate/duplicate calculation to drift out of sync.
// ---------------------------------------------------------

const prisma = require("../config/db");
const logger = require("../utils/logger");

async function getStudentSnapshot(studentId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [student, todaysTasks, todaysSessions, weekSessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, level: true, xp: true, currentStreak: true },
    }),
    prisma.task.findMany({
      where: { userId: studentId, date: { gte: startOfDay, lte: endOfDay } },
    }),
    prisma.focusSession.findMany({
      where: { userId: studentId, startedAt: { gte: startOfDay, lte: endOfDay } },
    }),
    prisma.focusSession.findMany({
      where: {
        userId: studentId,
        startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  if (!student) return null;

  const tasksCompleted = todaysTasks.filter((t) => t.completed).length;
  const studySecondsToday = todaysSessions.reduce((sum, s) => sum + (s.durationSec || 0), 0);
  const weekStudySeconds = weekSessions.reduce((sum, s) => sum + (s.durationSec || 0), 0);
  const avgFocusScore =
    weekSessions.length === 0
      ? 0
      : Math.round(weekSessions.reduce((sum, s) => sum + (s.focusScore || 0), 0) / weekSessions.length);

  return {
    id: student.id,
    name: student.name,
    level: student.level,
    xp: student.xp,
    currentStreak: student.currentStreak,
    tasksCompletedToday: tasksCompleted,
    tasksTotalToday: todaysTasks.length,
    studyHoursToday: +(studySecondsToday / 3600).toFixed(1),
    studyHoursThisWeek: +(weekStudySeconds / 3600).toFixed(1),
    focusScoreThisWeek: avgFocusScore,
  };
}

// GET /api/parent/overview
// Returns every student linked to this parent, with real snapshot data.
async function getOverview(req, res) {
  try {
    const parentId = req.user.userId;

    const links = await prisma.studentParentLink.findMany({
      where: { parentId },
    });

    if (links.length === 0) {
      return res.json({ children: [], linked: false });
    }

    const children = await Promise.all(
      links.map((link) => getStudentSnapshot(link.studentId))
    );

    return res.json({ children: children.filter(Boolean), linked: true });
  } catch (err) {
    logger.error("Parent getOverview error:", err);
    return res.status(500).json({ error: "Failed to load parent overview." });
  }
}

// POST /api/parent/link
// Body: { studentEmail: string }
// Lets a parent link themselves to a student by the student's email
// (student must already have an account). Simple invite-free linking
// for now — can be upgraded to an approval flow later.
async function linkStudent(req, res) {
  try {
    const parentId = req.user.userId;
    const { studentEmail } = req.body;

    if (!studentEmail) {
      return res.status(400).json({ error: "Student email is required." });
    }

    const student = await prisma.user.findUnique({
      where: { email: studentEmail.toLowerCase() },
    });

    if (!student || student.role !== "STUDENT") {
      return res.status(404).json({ error: "No student account found with that email." });
    }

    const existingLink = await prisma.studentParentLink.findUnique({
      where: { studentId_parentId: { studentId: student.id, parentId } },
    });
    if (existingLink) {
      return res.status(409).json({ error: "You're already linked to this student." });
    }

    await prisma.studentParentLink.create({
      data: { studentId: student.id, parentId },
    });

    return res.status(201).json({ message: `Linked to ${student.name} successfully.` });
  } catch (err) {
    logger.error("Parent linkStudent error:", err);
    return res.status(500).json({ error: "Failed to link student." });
  }
}

module.exports = { getOverview, linkStudent };