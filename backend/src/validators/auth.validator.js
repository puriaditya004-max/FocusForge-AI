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
const VALID_PREPARATION_TRACKS = [
  "CLASS_10",
  "CLASS_12",
  "NEET",
  "JEE",
  "UPSC",
  "MPSC",
  "MEDICAL",
  "ENGINEERING",
  "LLB",
  "OTHER",
];

const passwordRule = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(72, "Password is too long.") // bcrypt silently truncates beyond 72 bytes
  .regex(/[A-Za-z]/, "Password must include at least one letter.")
  .regex(/[0-9]/, "Password must include at least one number.")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character.");

// Optional for now (existing accounts have none), but every NEW signup is
// asked for it. This is the field that eventually lets the app tell which
// accounts belong to minors — required before any real parental-consent
// or children's-data-law handling can exist. Sanity-bounded: no future
// dates, and nobody realistically signing up is over 120.
const dateOfBirthRule = z
  .string()
  .trim()
  .refine((val) => !Number.isNaN(Date.parse(val)), "Please enter a valid date of birth.")
  .refine((val) => new Date(val) <= new Date(), "Date of birth can't be in the future.")
  .refine((val) => {
    const years = (Date.now() - new Date(val).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return years <= 120;
  }, "Please enter a valid date of birth.")
  .optional();

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
  role: z.enum(VALID_ROLES).optional(),
});

const loginSchema = z
  .object({
    identifier: z.string().trim().max(120, "Digital ID is too long.").optional(),
    email: z.string().trim().toLowerCase().email("Please enter a valid email address.").optional(),
    password: z.string().min(1, "Password is required."),
  })
  .transform((data) => ({
    identifier: data.identifier || data.email || "",
    password: data.password,
  }))
  .refine((data) => data.identifier.length >= 3, {
    path: ["identifier"],
    message: "Digital ID is required.",
  });

const completeOnboardingSchema = z
  .object({
    preparationTrack: z.enum(VALID_PREPARATION_TRACKS),
    preparationOther: z.string().trim().max(80, "Preparation detail is too long.").optional(),
    dateOfBirth: dateOfBirthRule.refine(Boolean, "Date of birth is required."),
    avatarUrl: z.string().trim().url("Photo URL must be valid.").max(500).optional().or(z.literal("")),
    password: passwordRule,
  })
  .refine((data) => data.preparationTrack !== "OTHER" || !!data.preparationOther, {
    path: ["preparationOther"],
    message: "Please enter your preparation goal.",
  });

const verifyEmailSchema = z.object({
  verificationToken: z.string().trim().min(20, "Verification session is required."),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP."),
});

const resendEmailVerificationSchema = z.object({
  verificationToken: z.string().trim().min(20, "Verification session is required."),
});

const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP."),
  password: passwordRule,
});

const requestOtpSchema = z.object({
  channel: z.enum(["EMAIL", "MOBILE"]),
  target: z.string().trim().min(3).max(120).optional(),
});

const verifyOtpSchema = z.object({
  channel: z.enum(["EMAIL", "MOBILE"]),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit OTP."),
  target: z.string().trim().min(3).max(120).optional(),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required."),
  confirmation: z
    .string()
    .trim()
    .refine((value) => value === "DELETE", 'Type "DELETE" to confirm.'),
});

module.exports = {
  signupSchema,
  loginSchema,
  completeOnboardingSchema,
  verifyEmailSchema,
  resendEmailVerificationSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  requestOtpSchema,
  verifyOtpSchema,
  deleteAccountSchema,
};
