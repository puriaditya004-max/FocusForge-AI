const { z } = require("zod");

const dataUrl = z.string().startsWith("data:", "Upload must be a base64 data URL.");

const teacherVerificationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  institute: z.string().trim().max(160).optional(),
  qualification: z.string().trim().max(160).optional(),
  experienceYears: z.coerce.number().int().min(0).max(80).optional(),
  idDocumentDataUrl: dataUrl,
  educationDocumentDataUrl: dataUrl.optional(),
  notes: z.string().trim().max(1000).optional(),
});

const teacherReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewerNotes: z.string().trim().max(1000).optional(),
});

const courseVideoSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  videoDataUrl: dataUrl.optional(),
  videoUrl: z.string().trim().url().optional(),
  durationSec: z.coerce.number().int().min(0).max(24 * 60 * 60).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  isPreview: z.boolean().optional(),
}).refine((body) => body.videoDataUrl || body.videoUrl, {
  message: "Provide either videoDataUrl or videoUrl.",
  path: ["videoDataUrl"],
});

module.exports = { teacherVerificationSchema, teacherReviewSchema, courseVideoSchema };
