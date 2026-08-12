// ---------------------------------------------------------
// certificate.controller.js - Certificate Exam attempt &
// result tracking.
//
// Certificate exams are generated from the student's completed
// Month 1 roadmap/tasks, stored server-side with the answer key,
// and graded on the backend. There is intentionally no generic
// Python fallback: if a NEET Biology student completes Biology,
// their certificate and exam must be Biology.
// ---------------------------------------------------------
const crypto = require("crypto");
const prisma = require("../config/db");
const logger = require("../utils/logger");
const { recordGeminiCall } = require("../utils/aiUsage");

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_ATTEMPTS = 2;
const PASS_SCORE = 97;
const COOLDOWN_DAYS = 4;
const CERTIFICATE_QUESTION_COUNT = 50;

function canBypassRoadmapGate(req) {
  return (
    req.user?.role === "ADMIN" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.CERTIFICATE_EXAM_TEST_BYPASS === "true")
  );
}

function sendRoadmapGateError(res) {
  return res.status(403).json({
    message: "Complete Month 1 roadmap before starting the certificate exam",
  });
}

function generateCertCode(topic) {
  const slug = topic
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .slice(0, 20);
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `FF-${slug}-${random}`;
}

function parseTopicFromMonthLabel(monthLabel) {
  return String(monthLabel || "")
    .replace(/\s+Month\s+\d+.*/i, "")
    .split(":")[0]
    ?.trim();
}

function normalizeTitle(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+Month\s+\d+.*/i, "")
    .replace(/\s+Month\s+\d+.*/i, "")
    .trim();
}

function buildCertificateTitle(monthItems) {
  const candidates = monthItems.flatMap((item) => [
    parseTopicFromMonthLabel(item.monthLabel),
    item.monthLabel,
    item.title,
  ]);
  const base =
    candidates
      .map(normalizeTitle)
      .find((candidate) => candidate && candidate.length >= 3) ||
    "Month 1 Syllabus";

  return `${base} - Month 1`;
}

function hashSyllabus(syllabus) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(syllabus))
    .digest("hex")
    .slice(0, 32);
}

function safeParseJson(raw) {
  try {
    const cleaned = String(raw || "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function validateQuestions(parsed) {
  const list = Array.isArray(parsed?.questions) ? parsed.questions : null;
  if (!list || list.length < 20) return null;

  const normalized = [];
  const max = Math.min(list.length, CERTIFICATE_QUESTION_COUNT);

  for (let i = 0; i < max; i++) {
    const item = list[i];
    const q = String(item.q || item.question || "").trim();
    const options = Array.isArray(item.options)
      ? item.options.map((option) => String(option || "").trim())
      : [];
    const answer = Number(item.answer ?? item.correctIndex);
    const type = item.type === "project" ? "project" : "theory";

    if (!q || options.length !== 4 || !Number.isInteger(answer) || answer < 0 || answer > 3) {
      return null;
    }
    if (options.some((option) => !option)) return null;

    normalized.push({
      id: i + 1,
      type,
      q,
      options,
      answer,
    });
  }

  return normalized.length >= 20 ? normalized : null;
}

async function callGeminiForCertificateExam(syllabus, topic) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing");
  }

  const safetySettings = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  ];

  const systemPrompt = `You are FocusForge AI's Certificate Exam Generator.
Create a trustworthy certificate exam based ONLY on the student's completed Month 1 syllabus.
The exam must match the learner's actual domain, class, exam goal, and topics.
Do not default to Python, coding, software, or generic study skills unless those appear in the syllabus.

Return ONLY strict JSON, no markdown:
{"questions":[{"type":"theory","q":"...","options":["A","B","C","D"],"answer":0}]}

Rules:
- Generate exactly ${CERTIFICATE_QUESTION_COUNT} MCQs.
- Each question has exactly 4 options and exactly one answer index from 0 to 3.
- Around 40 should test concepts; around 10 should test application/project/practice from the syllabus.
- Difficulty should be suitable for the stated class/exam goal, for example NEET, Class 12 board, JEE, coding, or the user's requested plan.
- Do not mention that the questions were AI-generated.
- Do not include explanations, answers outside the answer index, or text outside JSON.`;

  const userPrompt = `Certificate title: ${topic}

Completed Month 1 syllabus JSON:
${JSON.stringify(syllabus, null, 2)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      safetySettings,
    }),
  });

  recordGeminiCall();

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini certificate exam error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const blockReason = data?.promptFeedback?.blockReason;
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (blockReason || finishReason === "SAFETY") {
    logger.warn("Gemini blocked certificate exam generation:", { blockReason, finishReason });
    return null;
  }

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return validateQuestions(safeParseJson(raw));
}

async function resolveCertificateContext(userId) {
  const monthItems = await prisma.roadmapItem.findMany({
    where: { userId, monthNumber: 1 },
    orderBy: { weekNumber: "asc" },
  });

  const completedTasks = await prisma.task.findMany({
    where: { userId, monthNumber: 1, completed: true },
    orderBy: [{ weekNumber: "asc" }, { date: "asc" }],
    take: 80,
  });

  const completedItems = monthItems.filter((item) => item.status === "COMPLETED").length;
  const roadmapPercent = monthItems.length
    ? Math.round((completedItems / monthItems.length) * 100)
    : 0;

  const topic = buildCertificateTitle(monthItems);
  const projectsRequired = monthItems.map((item) => item.project).filter(Boolean);
  const syllabus = {
    certificateTitle: topic,
    monthNumber: 1,
    roadmap: monthItems.map((item) => ({
      weekNumber: item.weekNumber,
      monthLabel: item.monthLabel,
      title: item.title,
      description: item.description,
      tools: item.tools,
      hours: item.hours,
      project: item.project,
      status: item.status,
    })),
    completedTasks: completedTasks.map((task) => ({
      weekNumber: task.weekNumber,
      title: task.title,
      category: task.category,
      priority: task.priority,
      date: task.date,
    })),
  };

  return {
    topic,
    syllabus,
    syllabusHash: hashSyllabus(syllabus),
    projectsRequired,
    roadmapPercent,
    roadmapComplete: monthItems.length > 0 && completedItems === monthItems.length,
    totalRoadmapItems: monthItems.length,
  };
}

async function getOrCreateExamBank(context) {
  const existing = await prisma.certificateExamBank.findFirst({
    where: {
      userId: context.userId,
      topic: context.topic,
      syllabusHash: context.syllabusHash,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;

  const questions = await callGeminiForCertificateExam(context.syllabus, context.topic);
  if (!questions) {
    return null;
  }

  return prisma.certificateExamBank.create({
    data: {
      userId: context.userId,
      topic: context.topic,
      syllabusHash: context.syllabusHash,
      syllabus: context.syllabus,
      questions,
    },
  });
}

function safeQuestions(bank) {
  return (bank.questions || []).map(({ id, type, q, options }) => ({ id, type, q, options }));
}

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
    totalQuestions: CERTIFICATE_QUESTION_COUNT,
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

const getQuestions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const context = await resolveCertificateContext(userId);
    context.userId = userId;

    const status = await buildStatus(userId, context);
    if (!status.roadmapComplete && !canBypassRoadmapGate(req)) {
      return sendRoadmapGateError(res);
    }
    if (status.isLocked) {
      return res.status(403).json({ message: "No attempts remaining for this certificate" });
    }
    if (status.cooldownDaysLeft > 0) {
      return res.status(403).json({ message: "Still in cooldown period" });
    }
    if (status.certEarned) {
      return res.status(403).json({ message: "Certificate already earned for this topic" });
    }

    const bank = await getOrCreateExamBank(context);
    if (!bank) {
      return res.status(502).json({
        message: "Could not prepare a certificate exam for your completed syllabus. Please try again.",
      });
    }

    res.status(200).json({
      topic: context.topic,
      questions: safeQuestions(bank),
      totalQuestions: bank.questions.length,
      passScore: PASS_SCORE,
      maxAttempts: MAX_ATTEMPTS,
    });
  } catch (err) {
    logger.error("getQuestions error:", err);
    res.status(500).json({ message: "Failed to fetch exam questions" });
  }
};

const getStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const context = await resolveCertificateContext(userId);
    const status = await buildStatus(userId, context);
    res.status(200).json(status);
  } catch (err) {
    logger.error("getStatus error:", err);
    res.status(500).json({ message: "Failed to fetch exam status" });
  }
};

const submitExam = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { answers, startedAt } = req.body;
    const context = await resolveCertificateContext(userId);
    context.userId = userId;
    const { topic, projectsRequired } = context;

    if (!topic || !answers || typeof answers !== "object") {
      return res.status(400).json({ message: "answers are required" });
    }

    const status = await buildStatus(userId, context);
    if (!status.roadmapComplete && !canBypassRoadmapGate(req)) {
      return sendRoadmapGateError(res);
    }
    if (status.isLocked) {
      return res.status(403).json({ message: "No attempts remaining for this certificate" });
    }
    if (status.cooldownDaysLeft > 0) {
      return res.status(403).json({ message: "Still in cooldown period" });
    }
    if (status.certEarned) {
      return res.status(403).json({ message: "Certificate already earned for this topic" });
    }

    const bank = await prisma.certificateExamBank.findFirst({
      where: { userId, topic, syllabusHash: context.syllabusHash },
      orderBy: { updatedAt: "desc" },
    });
    if (!bank) {
      return res.status(409).json({
        message: "Certificate exam questions expired or were not prepared. Please start the exam again.",
      });
    }

    let correct = 0;
    for (const question of bank.questions || []) {
      if (answers[question.id] === question.answer) correct++;
    }
    const totalQuestions = bank.questions.length;
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
