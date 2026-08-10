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
  time: z
    .string()
    .trim()
    .max(20, "Time must be under 20 characters.")
    .optional()
    .or(z.literal("")),
  duration: z
    .string()
    .trim()
    .max(30, "Duration must be under 30 characters.")
    .optional()
    .or(z.literal("")),
});

// PATCH /api/tasks/:id — used by Today's Plan's manual time/duration editing
const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Task title cannot be empty.")
      .max(150, "Task title must be under 150 characters.")
      .optional(),
    time: z
      .string()
      .trim()
      .max(20, "Time must be under 20 characters.")
      .optional()
      .or(z.literal("")),
    duration: z
      .string()
      .trim()
      .max(30, "Duration must be under 30 characters.")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

module.exports = { createTaskSchema, updateTaskSchema };
