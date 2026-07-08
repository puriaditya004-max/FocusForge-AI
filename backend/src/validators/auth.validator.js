// ---------------------------------------------------------
// validators/auth.validator.js
// Zod schemas for signup/login.
//
// Password policy is intentionally strict — these are student
// accounts (often reused across other services by minors), so
// we require: 8+ chars, at least one letter, one number, and
// one special character. This is stricter than the old
// "6 characters minimum" check.
// ---------------------------------------------------------
const { z } = require("zod");

const VALID_ROLES = ["STUDENT", "PARENT", "TEACHER"];

const passwordRule = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(72, "Password is too long.") // bcrypt silently truncates beyond 72 bytes
  .regex(/[A-Za-z]/, "Password must include at least one letter.")
  .regex(/[0-9]/, "Password must include at least one number.")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character.");

const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address.")
    .max(120, "Email is too long."),
  password: passwordRule,
  role: z.enum(VALID_ROLES).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

module.exports = { signupSchema, loginSchema };