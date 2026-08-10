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

  const [student, todaysTasks, todaysSessions, weekSessions, currentRoadmap, recentActivity] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        level: true,
        xp: true,
        currentStreak: true,
        longestStreak: true,
        dailyGoalHours: true,
      },
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
    prisma.roadmapItem.findFirst({
      where: { userId: studentId, status: { not: "COMPLETED" } },
      orderBy: { weekNumber: "asc" },
      select: { weekNumber: true, monthLabel: true, title: true, status: true },
    }),
    prisma.activityLog.findMany({
      where: { userId: studentId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, icon: true, text: true, xp: true, createdAt: true },
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
    longestStreak: student.longestStreak,
    dailyGoalHours: student.dailyGoalHours,
    tasksCompletedToday: tasksCompleted,
    tasksTotalToday: todaysTasks.length,
    studyHoursToday: +(studySecondsToday / 3600).toFixed(1),
    studyHoursThisWeek: +(weekStudySeconds / 3600).toFixed(1),
    focusScoreThisWeek: avgFocusScore,
    currentFocus: currentRoadmap
      ? {
          weekNumber: currentRoadmap.weekNumber,
          monthLabel: currentRoadmap.monthLabel,
          title: currentRoadmap.title,
          status: currentRoadmap.status,
        }
      : null,
    recentActivity,
  };
}

// GET /api/parent/overview
// Returns every student linked to this parent, with real snapshot data.
async function getOverview(req, res) {
  try {
    const parentId = req.user.userId;

    // Only APPROVED links can expose a student's data to a parent.
    // Pending/rejected requests must never show up here.
    const [links, pendingLinks] = await Promise.all([
      prisma.studentParentLink.findMany({
        where: { parentId, status: "APPROVED" },
      }),
      prisma.studentParentLink.findMany({
        where: { parentId, status: "PENDING" },
        include: { student: { select: { id: true, name: true, email: true } } },
        orderBy: { connectedAt: "desc" },
      }),
    ]);

    const children = await Promise.all(
      links.map((link) => getStudentSnapshot(link.studentId))
    );

    return res.json({
      children: children.filter(Boolean),
      linked: links.length > 0,
      pendingRequests: pendingLinks.map((link) => ({
        id: link.id,
        studentId: link.student.id,
        studentName: link.student.name,
        studentEmail: link.student.email,
        requestedAt: link.connectedAt,
      })),
    });
  } catch (err) {
    logger.error("Parent getOverview error:", err);
    return res.status(500).json({ error: "Failed to load parent overview." });
  }
}

// POST /api/parent/link
// Body: { studentEmail: string }
// Lets a parent REQUEST a link to a student by the student's email
// (student must already have an account). This no longer grants access
// immediately — it creates a PENDING request that the student must
// approve from their own dashboard (see getPendingRequests / respondToRequest
// below). A parent cannot see any student data until the student confirms.
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
      if (existingLink.status === "PENDING") {
        return res.status(409).json({ error: "A link request is already pending for this student." });
      }
      if (existingLink.status === "APPROVED") {
        return res.status(409).json({ error: "You're already linked to this student." });
      }
      // Previously REJECTED — allow a fresh request by resetting it to PENDING.
      await prisma.studentParentLink.update({
        where: { id: existingLink.id },
        data: { status: "PENDING", respondedAt: null },
      });
      return res.status(201).json({ message: `Link request sent to ${student.name}. Waiting for their approval.` });
    }

    await prisma.studentParentLink.create({
      data: { studentId: student.id, parentId, status: "PENDING" },
    });

    return res.status(201).json({ message: `Link request sent to ${student.name}. Waiting for their approval.` });
  } catch (err) {
    logger.error("Parent linkStudent error:", err);
    return res.status(500).json({ error: "Failed to send link request." });
  }
}

// GET /api/parent/requests/pending   (STUDENT role)
// Lists parent link requests waiting on this student's decision.
async function getPendingRequests(req, res) {
  try {
    const studentId = req.user.userId;

    const requests = await prisma.studentParentLink.findMany({
      where: { studentId, status: "PENDING" },
      include: { parent: { select: { id: true, name: true, email: true } } },
      orderBy: { connectedAt: "desc" },
    });

    return res.json({
      requests: requests.map((r) => ({
        id: r.id,
        parentName: r.parent.name,
        parentEmail: r.parent.email,
        requestedAt: r.connectedAt,
      })),
    });
  } catch (err) {
    logger.error("getPendingRequests error:", err);
    return res.status(500).json({ error: "Failed to load pending requests." });
  }
}

// POST /api/parent/requests/:id/respond   (STUDENT role)
// Body: { approve: boolean }
// The student is the only one who can turn a PENDING request into
// APPROVED or REJECTED — this is the actual consent step.
async function respondToRequest(req, res) {
  try {
    const studentId = req.user.userId;
    const { id } = req.params;
    const { approve } = req.body;

    if (typeof approve !== "boolean") {
      return res.status(400).json({ error: "approve (true/false) is required." });
    }

    const link = await prisma.studentParentLink.findUnique({ where: { id } });

    // Ownership check — a student can only respond to requests addressed
    // to them, and only while still PENDING (no re-deciding a settled one).
    if (!link || link.studentId !== studentId) {
      return res.status(404).json({ error: "Request not found." });
    }
    if (link.status !== "PENDING") {
      return res.status(409).json({ error: "This request has already been responded to." });
    }

    const updated = await prisma.studentParentLink.update({
      where: { id },
      data: { status: approve ? "APPROVED" : "REJECTED", respondedAt: new Date() },
    });

    return res.json({
      message: approve ? "Parent link approved." : "Parent link rejected.",
      status: updated.status,
    });
  } catch (err) {
    logger.error("respondToRequest error:", err);
    return res.status(500).json({ error: "Failed to respond to request." });
  }
}

module.exports = { getOverview, linkStudent, getPendingRequests, respondToRequest };
