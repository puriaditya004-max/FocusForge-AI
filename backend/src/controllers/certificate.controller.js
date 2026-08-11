// ---------------------------------------------------------
// certificate.controller.js — Certificate Exam attempt &
// result tracking. Replaces the old localStorage-based
// attempt state with real backend persistence.
//
// Question content lives server-side only (data/certificateQuestions.js).
// GET /questions strips the `answer` field before responding, and
// POST /submit grades against the real question bank on the server —
// the client only ever sends its selected option indices, never a
// score. This is what makes the issued certificate trustworthy.
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");
const { CERTIFICATE_QUESTIONS } = require("../data/certificateQuestions");

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

function parseTopicFromMonthLabel(monthLabel) {
  return String(monthLabel || "").replace(/\s+Month\s+\d+.*/i, "").split(":")[0]?.trim();
}

async function resolveCertificateContext(userId, requestedTopic) {
  const availableTopics = Object.keys(CERTIFICATE_QUESTIONS);
  let topic = requestedTopic && CERTIFICATE_QUESTIONS[requestedTopic] ? requestedTopic : null;

  const monthItems = await prisma.roadmapItem.findMany({
    where: { userId, monthNumber: 1 },
    orderBy: { weekNumber: "asc" },
  });

  if (!topic && monthItems.length) {
    const candidates = monthItems.flatMap((item) => [
      item.monthLabel,
      parseTopicFromMonthLabel(item.monthLabel),
      item.title,
    ]);
    topic = candidates.find((candidate) => candidate && CERTIFICATE_QUESTIONS[candidate]) || null;
  }

  if (!topic) {
    topic = availableTopics[0] || null;
  }

  const projectsRequired = monthItems
    .map((item) => item.project)
    .filter(Boolean);
  const completedItems = monthItems.filter((item) => item.status === "COMPLETED").length;
  const roadmapPercent = monthItems.length
    ? Math.round((completedItems / monthItems.length) * 100)
    : 0;

  return {
    topic,
    projectsRequired,
    roadmapPercent,
    roadmapComplete: monthItems.length > 0 && completedItems === monthItems.length,
    totalRoadmapItems: monthItems.length,
  };
}

// Build the status object the frontend needs to render the
// Intro / Locked / Certificate screens correctly.
async function buildStatus(userId, context) {
  const { topic } = context;
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
    topic,
    passScore: PASS_SCORE,
    maxAttempts: MAX_ATTEMPTS,
    cooldownDays: COOLDOWN_DAYS,
    totalQuestions: CERTIFICATE_QUESTIONS[topic]?.length || 0,
    projectsRequired: context.projectsRequired,
    roadmapPercent: context.roadmapPercent,
    roadmapComplete: context.roadmapComplete,
    totalRoadmapItems: context.totalRoadmapItems,
    attemptsUsed,
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

// GET /api/certificate-exam/questions?topic=...
// Returns the question bank for the topic with the `answer`
// field stripped — client gets id/type/q/options only, never
// the correct index.
const getQuestions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const context = await resolveCertificateContext(userId, req.query.topic);
    const { topic } = context;

    const bank = CERTIFICATE_QUESTIONS[topic];
    if (!bank) {
      return res.status(404).json({ message: "No question bank found for this topic" });
    }

    const status = await buildStatus(userId, context);
    if (status.isLocked) {
      return res.status(403).json({ message: "No attempts remaining for this certificate" });
    }
    if (status.cooldownDaysLeft > 0) {
      return res.status(403).json({ message: "Still in cooldown period" });
    }
    if (status.certEarned) {
      return res.status(403).json({ message: "Certificate already earned for this topic" });
    }

    const safeQuestions = bank.map(({ id, type, q, options }) => ({ id, type, q, options }));
    res.status(200).json({
      topic,
      questions: safeQuestions,
      totalQuestions: bank.length,
      passScore: PASS_SCORE,
      maxAttempts: MAX_ATTEMPTS,
    });
  } catch (err) {
    logger.error("getQuestions error:", err);
    res.status(500).json({ message: "Failed to fetch exam questions" });
  }
};

// GET /api/certificate-exam/status?topic=...
const getStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const context = await resolveCertificateContext(userId, req.query.topic);
    const status = await buildStatus(userId, context);
    res.status(200).json(status);
  } catch (err) {
    logger.error("getStatus error:", err);
    res.status(500).json({ message: "Failed to fetch exam status" });
  }
};

// POST /api/certificate-exam/submit
// body: { topic, answers, projectsCompleted, startedAt }
// `answers` is a map of { [questionId]: selectedOptionIndex } — the
// client never tells us the score, we compute it here against the
// real question bank so it can't be spoofed.
const submitExam = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { topic: requestedTopic, answers, startedAt } = req.body;
    const context = await resolveCertificateContext(userId, requestedTopic);
    const { topic, projectsRequired } = context;

    if (!topic || !answers || typeof answers !== "object") {
      return res.status(400).json({ message: "answers are required" });
    }

    const bank = CERTIFICATE_QUESTIONS[topic];
    if (!bank) {
      return res.status(404).json({ message: "No question bank found for this topic" });
    }

    const status = await buildStatus(userId, context);
    if (status.isLocked) {
      return res.status(403).json({ message: "No attempts remaining for this certificate" });
    }
    if (status.cooldownDaysLeft > 0) {
      return res.status(403).json({ message: "Still in cooldown period" });
    }
    if (status.certEarned) {
      return res.status(403).json({ message: "Certificate already earned for this topic" });
    }

    let correct = 0;
    for (const question of bank) {
      if (answers[question.id] === question.answer) correct++;
    }
    const totalQuestions = bank.length;
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
          projectsCompleted: projectsRequired || [],
        },
      });
    }

    const updatedStatus = await buildStatus(userId, context);
    res.status(200).json({ ...updatedStatus, score: pct, passed, correct, totalQuestions });
  } catch (err) {
    logger.error("submitExam error:", err);
    res.status(500).json({ message: "Failed to submit exam" });
  }
};

module.exports = {
  getQuestions,
  getStatus,
  submitExam,
};
