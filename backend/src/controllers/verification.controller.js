const prisma = require("../config/db");
const logger = require("../utils/logger");
const { saveDataUrl } = require("../utils/uploadStorage");

const DOCUMENT_MIMES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

async function getTeacherVerification(req, res) {
  try {
    const teacherId = req.user.userId;
    const [user, verification] = await Promise.all([
      prisma.user.findUnique({
        where: { id: teacherId },
        select: { teacherVerificationStatus: true, teacherVerifiedAt: true, razorpayRouteAccountId: true },
      }),
      prisma.teacherVerification.findUnique({ where: { teacherId } }),
    ]);
    return res.json({ status: user?.teacherVerificationStatus || "NOT_SUBMITTED", teacherVerifiedAt: user?.teacherVerifiedAt, razorpayRouteAccountId: user?.razorpayRouteAccountId, verification });
  } catch (err) {
    logger.error("getTeacherVerification error:", err);
    return res.status(500).json({ error: "Failed to load verification status." });
  }
}

async function submitTeacherVerification(req, res) {
  try {
    const teacherId = req.user.userId;
    const idDoc = await saveDataUrl(req.body.idDocumentDataUrl, `teacher-docs/${teacherId}`, DOCUMENT_MIMES, MAX_DOCUMENT_BYTES);
    const eduDoc = req.body.educationDocumentDataUrl
      ? await saveDataUrl(req.body.educationDocumentDataUrl, `teacher-docs/${teacherId}`, DOCUMENT_MIMES, MAX_DOCUMENT_BYTES)
      : null;

    const verification = await prisma.$transaction(async (tx) => {
      const saved = await tx.teacherVerification.upsert({
        where: { teacherId },
        update: {
          status: "PENDING",
          fullName: req.body.fullName,
          institute: req.body.institute || null,
          qualification: req.body.qualification || null,
          experienceYears: req.body.experienceYears ?? null,
          idDocumentUrl: idDoc.publicUrl,
          educationDocumentUrl: eduDoc?.publicUrl || null,
          notes: req.body.notes || null,
          reviewerNotes: null,
          submittedAt: new Date(),
          reviewedAt: null,
        },
        create: {
          teacherId,
          status: "PENDING",
          fullName: req.body.fullName,
          institute: req.body.institute || null,
          qualification: req.body.qualification || null,
          experienceYears: req.body.experienceYears ?? null,
          idDocumentUrl: idDoc.publicUrl,
          educationDocumentUrl: eduDoc?.publicUrl || null,
          notes: req.body.notes || null,
        },
      });
      await tx.user.update({ where: { id: teacherId }, data: { teacherVerificationStatus: "PENDING", teacherVerifiedAt: null } });
      return saved;
    });

    return res.status(201).json({ message: "Verification submitted for review.", verification });
  } catch (err) {
    logger.error("submitTeacherVerification error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to submit verification." });
  }
}

async function listTeacherVerifications(req, res) {
  try {
    const status = req.query.status || "PENDING";
    const verifications = await prisma.teacherVerification.findMany({
      where: status === "ALL" ? {} : { status },
      include: { teacher: { select: { id: true, name: true, email: true, razorpayRouteAccountId: true } } },
      orderBy: { submittedAt: "asc" },
    });
    return res.json({ verifications });
  } catch (err) {
    logger.error("listTeacherVerifications error:", err);
    return res.status(500).json({ error: "Failed to load verification queue." });
  }
}

async function reviewTeacherVerification(req, res) {
  try {
    const { id } = req.params;
    const approved = req.body.action === "approve";
    const now = new Date();

    const verification = await prisma.teacherVerification.findUnique({ where: { id } });
    if (!verification) return res.status(404).json({ error: "Verification request not found." });

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.teacherVerification.update({
        where: { id },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          reviewerNotes: req.body.reviewerNotes || null,
          reviewedAt: now,
        },
      });
      await tx.user.update({
        where: { id: verification.teacherId },
        data: {
          teacherVerificationStatus: approved ? "APPROVED" : "REJECTED",
          teacherVerifiedAt: approved ? now : null,
        },
      });
      return saved;
    });

    return res.json({ message: approved ? "Teacher approved." : "Teacher rejected.", verification: updated });
  } catch (err) {
    logger.error("reviewTeacherVerification error:", err);
    return res.status(500).json({ error: "Failed to review teacher verification." });
  }
}

module.exports = { getTeacherVerification, submitTeacherVerification, listTeacherVerifications, reviewTeacherVerification };
