// ---------------------------------------------------------
// validators/roadmap.validator.js
// Zod schema for the AI Smart Timetable generator.
// ---------------------------------------------------------
const { z } = require("zod");

// POST /api/roadmap/generate
const generateRoadmapSchema = z.object({
  prompt: z
    .string({ required_error: "Please describe the plan you want." })
    .trim()
    .min(3, "Please describe the plan you want (e.g. '2 month plan for NEET Biology').")
    .max(300, "Keep your request under 300 characters."),
});

const importRoadmapSchema = z.object({
  fileName: z
    .string({ required_error: "File name is required." })
    .trim()
    .min(1, "File name is required.")
    .max(160, "File name is too long."),
  mimeType: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"], {
    errorMap: () => ({ message: "Upload a PDF, PNG, JPG, or WEBP timetable." }),
  }),
  dataBase64: z
    .string({ required_error: "File data is required." })
    .min(100, "File data is missing or invalid.")
    .max(12 * 1024 * 1024, "Upload must be under 9MB."),
});

module.exports = { generateRoadmapSchema, importRoadmapSchema };
