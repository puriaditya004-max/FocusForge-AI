// ---------------------------------------------------------
// certificate.controller.js — Certificate Exam attempt &
// result tracking. Replaces the old localStorage-based
// attempt state with real backend persistence.
//
// Question content and answer-checking stay on the frontend
// (this is a self-study app, not a high-stakes proctored
// exam) — only the final result (score, pass/fail, attempts,
// cooldown, certificate) is persisted here.
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");

const MAX_ATTEMPTS = 2;
const PASS_SCORE = 97;
const COOLDOWN_DAYS = 4;

function generateCertCode(topic) {
  const slug = topic
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .slice(0, 20);
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `FF-${slug}-${random}`;
}

// Build the status object the frontend needs to render the
// Intro / Locked / Certificate screens correctly.
async function buildStatus(userId, topic) {
  const attempts = await prisma.examAttempt.findMany({
    where: { userId, topic },
    orderBy: { attemptNumber: "asc" },
  });

  const attemptsUsed = attempts.length;
  const certificate = await prisma.certificate.findFirst({
    where: { userId, title: topic },
  });

  const lastAttempt = attempts[attempts.length - 1];
  let cooldownDaysLeft = 0;
  if (lastAttempt && !lastAttempt.passed && lastAttempt.nextAttemptAvailableAt) {
    const msLeft = new Date(lastAttempt.nextAttemptAvailableAt).getTime() - Date.now();
    cooldownDaysLeft = msLeft > 0 ? msLeft / (1000 * 60 * 60 * 24) : 0;
  }

  const isLocked = attemptsUsed >= MAX_ATTEMPTS && !certificate;

  return {
    attemptsUsed,
    maxAttempts: MAX_ATTEMPTS,
    certEarned: !!certificate,
    certificate: certificate
      ? {
          id: certificate.id,
          certificateCode: certificate.certificateCode,
          title: certificate.title,
          score: certificate.score,
          projectsCompleted: certificate.projectsCompleted,
          issuedAt: certificate.issuedAt,
        }
      : null,
    cooldownDaysLeft,
    isLocked,
  };
}

// GET /api/certificate-exam/status?topic=...
const getStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const topic = req.query.topic;
    if (!topic) {
      return res.status(400).json({ message: "topic query param is required" });
    }
    const status = await buildStatus(userId, topic);
    res.status(200).json(status);
  } catch (err) {
    logger.error("getStatus error:", err);
    res.status(500).json({ message: "Failed to fetch exam status" });
  }
};

// POST /api/certificate-exam/submit
// body: { topic, correct, totalQuestions, projectsCompleted, startedAt }
const submitExam = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { topic, correct, totalQuestions, projectsCompleted, startedAt } = req.body;

    if (!topic || totalQuestions === undefined || correct === undefined) {
      return res.status(400).json({ message: "topic, correct, and totalQuestions are required" });
    }

    const status = await buildStatus(userId, topic);
    if (status.isLocked) {
      return res.status(403).json({ message: "No attempts remaining for this certificate" });
    }
    if (status.cooldownDaysLeft > 0) {
      return res.status(403).json({ message: "Still in cooldown period" });
    }
    if (status.certEarned) {
      return res.status(403).json({ message: "Certificate already earned for this topic" });
    }

    const pct = Math.round((correct / totalQuestions) * 100);
    const passed = pct >= PASS_SCORE;
    const attemptNumber = status.attemptsUsed + 1;

    await prisma.examAttempt.create({
      data: {
        userId,
        topic,
        attemptNumber,
        score: pct,
        passed,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        submittedAt: new Date(),
        nextAttemptAvailableAt: passed
          ? null
          : new Date(Date.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    if (passed) {
      await prisma.certificate.create({
        data: {
          userId,
          certificateCode: generateCertCode(topic),
          title: topic,
          score: pct,
          projectsCompleted: projectsCompleted || [],
        },
      });
    }

    const updatedStatus = await buildStatus(userId, topic);
    res.status(200).json({ ...updatedStatus, score: pct, passed });
  } catch (err) {
    logger.error("submitExam error:", err);
    res.status(500).json({ message: "Failed to submit exam" });
  }
};

module.exports = {
  getStatus,
  submitExam,
};