// ---------------------------------------------------------
// validators/mentor.validator.js
// Zod schemas for AI Mentor routes — these are the highest
// priority since text here goes straight into an AI prompt
// (Gemini/Claude), so length limits also protect against
// runaway token costs, not just bad input.
// ---------------------------------------------------------
const { z } = require("zod");

// POST /api/mentor/message
const sendMessageSchema = z.object({
  message: z
    .string({ required_error: "Message is required." })
    .trim()
    .min(1, "Message is required.")
    .max(4000, "Message must be under 4000 characters."),
  mode: z.enum(["chat", "doubt", "planner"]).optional(),
  file: z
    .object({
      mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"], {
        errorMap: () => ({ message: "Unsupported file type." }),
      }),
      dataBase64: z.string().min(1, "File data is empty."),
    })
    .optional(),
});

// POST /api/mentor/voice-command
const voiceCommandSchema = z.object({
  transcript: z
    .string({ required_error: "Transcript is required." })
    .trim()
    .min(1, "Transcript is required.")
    .max(1000, "Transcript must be under 1000 characters."),
});

// POST /api/mentor/generate-quiz
const generateQuizSchema = z.object({
  topic: z
    .string({ required_error: "Topic is required." })
    .trim()
    .min(1, "Topic is required.")
    .max(100, "Topic must be under 100 characters."),
  numQuestions: z
    .number({ invalid_type_error: "numQuestions must be a number." })
    .int()
    .min(1, "At least 1 question is required.")
    .max(20, "Maximum 20 questions per quiz.")
    .optional(),
});

// POST /api/mentor/quiz-attempt
const quizAttemptSchema = z.object({
  topic: z
    .string({ required_error: "Topic is required." })
    .trim()
    .min(1, "Topic is required.")
    .max(100, "Topic must be under 100 characters."),
  correctCount: z
    .number({ required_error: "correctCount is required." })
    .int()
    .min(0, "correctCount cannot be negative."),
  totalQuestions: z
    .number({ required_error: "totalQuestions is required." })
    .int()
    .min(1, "totalQuestions must be at least 1."),
});

module.exports = {
  sendMessageSchema,
  voiceCommandSchema,
  generateQuizSchema,
  quizAttemptSchema,
};