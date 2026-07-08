// ---------------------------------------------------------
// validators/task.validator.js
// Zod schemas for Task routes — mirrors auth.validator.js pattern.
// ---------------------------------------------------------
const { z } = require("zod");

// POST /api/tasks
const createTaskSchema = z.object({
  title: z
    .string({ required_error: "Task title is required." })
    .trim()
    .min(1, "Task title is required.")
    .max(150, "Task title must be under 150 characters."),
  subject: z
    .string()
    .trim()
    .max(50, "Subject must be under 50 characters.")
    .optional()
    .or(z.literal("")),
  priority: z
    .enum(["High", "Medium", "Low", "HIGH", "MEDIUM", "LOW"], {
      errorMap: () => ({ message: "Priority must be High, Medium, or Low." }),
    })
    .optional(),
});

module.exports = { createTaskSchema };