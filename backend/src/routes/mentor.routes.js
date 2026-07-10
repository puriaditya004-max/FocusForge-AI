// ===========================================================
// AI Mentor Routes — Forge AI Assistant
// ===========================================================

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { aiDailyLimiter, aiBurstLimiter } = require("../middleware/rateLimiter.middleware");
const {
  sendMessageSchema,
  voiceCommandSchema,
  generateQuizSchema,
  quizAttemptSchema,
} = require("../validators/mentor.validator");
const {
  sendMessage,
  getHistory,
  getRecommendations,
  handleVoiceCommand,
  getWeaknessReport,
  generateQuiz,
  submitQuizAttempt,
} = require("../controllers/mentor.controller");

// GET /api/mentor/history — load full chat history for logged-in student
router.get("/history", requireAuth, getHistory);

// POST /api/mentor/message — send a message (text and/or photo/PDF), get AI reply back
// requireAuth must run first — the AI limiters key off req.user.userId.
router.post(
  "/message",
  requireAuth,
  aiBurstLimiter,
  aiDailyLimiter,
  validate(sendMessageSchema),
  sendMessage
);

// GET /api/mentor/recommendations — real, data-driven Smart Insights
router.get("/recommendations", requireAuth, getRecommendations);

// POST /api/mentor/voice-command — global "Hey Forge" floating widget
router.post(
  "/voice-command",
  requireAuth,
  aiBurstLimiter,
  aiDailyLimiter,
  validate(voiceCommandSchema),
  handleVoiceCommand
);

// GET /api/mentor/weakness-report — real weak-topic detection from
// ExamAttempt scores + FocusSession focus scores + QuizAttempt results
router.get("/weakness-report", requireAuth, getWeaknessReport);

// POST /api/mentor/generate-quiz — AI generates an MCQ quiz on a topic
router.post(
  "/generate-quiz",
  requireAuth,
  aiBurstLimiter,
  aiDailyLimiter,
  validate(generateQuizSchema),
  generateQuiz
);

// POST /api/mentor/quiz-attempt — save a real quiz result
router.post("/quiz-attempt", requireAuth, validate(quizAttemptSchema), submitQuizAttempt);

module.exports = router;