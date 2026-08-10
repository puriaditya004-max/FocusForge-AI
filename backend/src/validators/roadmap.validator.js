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

module.exports = { generateRoadmapSchema };
