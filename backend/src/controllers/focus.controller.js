// ---------------------------------------------------------
// focus.controller.js — Focus Mode session tracking
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");

// Helper: reshape a session from Prisma format -> frontend format
const formatSession = (session) => ({
  id: session.id,
  startedAt: session.startedAt,
  endedAt: session.endedAt,
  durationSec: session.durationSec,
  focusScore: session.focusScore,
  distractions: session.distractions,
  subject: session.subject || "",
});

// POST /api/focus
// Saves a completed focus session for the logged-in user
const createSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startedAt, durationSec, focusScore, distractions, subject } = req.body;

    if (!durationSec || durationSec <= 0) {
      return res.status(400).json({ message: "Session duration must be greater than 0" });
    }

    const session = await prisma.focusSession.create({
      data: {
        userId,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        endedAt: new Date(),
        durationSec,
        focusScore: focusScore ?? 0,
        distractions: distractions ?? 0,
        subject: subject || null,
      },
    });

    res.status(201).json(formatSession(session));
  } catch (err) {
    logger.error("createSession error:", err);
    res.status(500).json({ message: "Failed to save focus session" });
  }
};

// GET /api/focus
// Returns all focus sessions for the logged-in user (most recent first)
const getSessions = async (req, res) => {
  try {
    const userId = req.user.userId;

    const sessions = await prisma.focusSession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
    });

    res.status(200).json(sessions.map(formatSession));
  } catch (err) {
    logger.error("getSessions error:", err);
    res.status(500).json({ message: "Failed to fetch focus sessions" });
  }
};

module.exports = {
  createSession,
  getSessions,
};