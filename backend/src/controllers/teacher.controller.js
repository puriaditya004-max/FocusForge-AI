// ---------------------------------------------------------
// controllers/teacher.controller.js
// Teacher Dashboard — 100% real data, with an enrollment
// approval flow. Only APPROVED enrollments count toward
// real student totals and real earnings — pending requests
// don't inflate the numbers until the teacher confirms
// payment and approves them.
// ---------------------------------------------------------

const prisma = require("../config/db");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const { saveDataUrl, UPLOAD_ROOT } = require("../utils/uploadStorage");
const { s3Client, BUCKET, PUBLIC_BASE_URL } = require("../config/storage");
const { Upload } = s3Client ? require("@aws-sdk/lib-storage") : {};

const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
// The base64 JSON path (addCourseVideo, below) goes through express.json's
// 10mb body limit — base64 inflates raw bytes by ~33%, so anything much
// over ~6MB raw will be rejected by the body parser before it even reaches
// this controller. That's fine for short preview clips; real lecture-length
// videos should use uploadCourseVideo (multipart, streamed to disk, up to
// MAX_VIDEO_BYTES) instead.
const MAX_BASE64_VIDEO_BYTES = 6 * 1024 * 1024;
const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

// GET /api/teacher/overview
async function getOverview(req, res) {
  try {
    const teacherId = req.user.userId;

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { teacherVerificationStatus: true, teacherVerifiedAt: true, razorpayRouteAccountId: true },
    });
    const verification = await prisma.teacherVerification.findUnique({
      where: { teacherId },
      select: { status: true, reviewerNotes: true, reviewedAt: true, submittedAt: true },
    });

    const courses = await prisma.course.findMany({
      where: { teacherId },
      include: { enrollments: true, videos: true, payments: true },
      orderBy: { createdAt: "desc" },
    });

    let grossRevenuePaise = 0;
    let teacherEarningsPaise = 0;
    let paidOutPaise = 0;
    const uniqueApprovedStudentIds = new Set();
    let pendingRequestCount = 0;
    let paidPaymentCount = 0;
    const payoutCounts = { NOT_READY: 0, ROUTE_PENDING: 0, ROUTE_LINKED: 0, PAID_OUT: 0, FAILED: 0 };

    const courseSummaries = courses.map((c) => {
      const approved = c.enrollments.filter((e) => e.status === "APPROVED");
      const pending = c.enrollments.filter((e) => e.status === "PENDING");
      const paidPayments = c.payments.filter((p) => p.status === "PAID");

      approved.forEach((e) => uniqueApprovedStudentIds.add(e.studentId));
      pendingRequestCount += pending.length;
      paidPaymentCount += paidPayments.length;

      const courseRevenuePaise = paidPayments.reduce((sum, p) => sum + (p.amountPaise || 0), 0);
      const courseTeacherPaise = paidPayments.reduce((sum, p) => sum + (p.teacherAmountPaise || 0), 0);
      const coursePaidOutPaise = paidPayments
        .filter((p) => p.payoutStatus === "PAID_OUT")
        .reduce((sum, p) => sum + (p.teacherAmountPaise || 0), 0);

      grossRevenuePaise += courseRevenuePaise;
      teacherEarningsPaise += courseTeacherPaise;
      paidOutPaise += coursePaidOutPaise;
      paidPayments.forEach((p) => {
        payoutCounts[p.payoutStatus] = (payoutCounts[p.payoutStatus] || 0) + 1;
      });

      return {
        id: c.id,
        title: c.title,
        price: c.price,
        studentsEnrolled: approved.length,
        pendingRequests: pending.length,
        paidPayments: paidPayments.length,
        grossRevenuePaise: courseRevenuePaise,
        teacherEarningsPaise: courseTeacherPaise,
        paidOutPaise: coursePaidOutPaise,
        videoCount: c.videos.length,
        previewVideoCount: c.videos.filter((v) => v.isPreview).length,
        published: c.published,
        createdAt: c.createdAt,
      };
    });

    return res.json({
      verificationStatus: teacher?.teacherVerificationStatus || "NOT_SUBMITTED",
      teacherVerifiedAt: teacher?.teacherVerifiedAt,
      verificationReviewerNotes: verification?.reviewerNotes || null,
      verificationReviewedAt: verification?.reviewedAt || null,
      verificationSubmittedAt: verification?.submittedAt || null,
      razorpayRouteAccountId: teacher?.razorpayRouteAccountId,
      totalCourses: courses.length,
      totalStudents: uniqueApprovedStudentIds.size,
      totalEarnings: +(teacherEarningsPaise / 100).toFixed(2),
      grossRevenuePaise,
      teacherEarningsPaise,
      paidOutPaise,
      pendingPayoutPaise: Math.max(teacherEarningsPaise - paidOutPaise, 0),
      paidPaymentCount,
      payoutCounts,
      pendingRequestCount,
      courses: courseSummaries,
    });
  } catch (err) {
    logger.error("Teacher getOverview error:", err);
    return res.status(500).json({ error: "Failed to load teacher overview." });
  }
}

// POST /api/teacher/courses
async function createCourse(req, res) {
  try {
    const teacherId = req.user.userId;
    const { title, description, price } = req.body;

    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { teacherVerificationStatus: true },
    });
    if (teacher?.teacherVerificationStatus !== "APPROVED") {
      return res.status(403).json({ error: "Teacher verification must be approved before publishing courses." });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Course title is required." });
    }

    const course = await prisma.course.create({
      data: {
        teacherId,
        title: title.trim(),
        description: description?.trim() || null,
        price: Number(price) || 0,
        published: true,
      },
    });

    return res.status(201).json({ course });
  } catch (err) {
    logger.error("Teacher createCourse error:", err);
    return res.status(500).json({ error: "Failed to create course." });
  }
}

async function listCourseVideos(req, res) {
  try {
    const teacherId = req.user.userId;
    const { courseId } = req.params;
    const course = await prisma.course.findFirst({ where: { id: courseId, teacherId } });
    if (!course) return res.status(404).json({ error: "Course not found." });

    const videos = await prisma.courseVideo.findMany({
      where: { courseId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return res.json({ videos });
  } catch (err) {
    logger.error("listCourseVideos error:", err);
    return res.status(500).json({ error: "Failed to load course videos." });
  }
}

async function requireApprovedTeacher(teacherId) {
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { teacherVerificationStatus: true },
  });
  return teacher?.teacherVerificationStatus === "APPROVED";
}

async function addCourseVideo(req, res) {
  try {
    const teacherId = req.user.userId;
    const { courseId } = req.params;
    const course = await prisma.course.findFirst({ where: { id: courseId, teacherId } });
    if (!course) return res.status(404).json({ error: "Course not found." });
    if (!(await requireApprovedTeacher(teacherId))) {
      return res.status(403).json({ error: "Teacher verification must be approved before adding course videos." });
    }

    let videoUrl = req.body.videoUrl;
    let storageKey = null;
    if (req.body.videoDataUrl) {
      const saved = await saveDataUrl(req.body.videoDataUrl, `course-videos/${courseId}`, VIDEO_MIMES, MAX_BASE64_VIDEO_BYTES);
      videoUrl = saved.publicUrl;
      storageKey = saved.storageKey;
    }

    const video = await prisma.courseVideo.create({
      data: {
        courseId,
        title: req.body.title,
        description: req.body.description || null,
        videoUrl,
        storageKey,
        durationSec: req.body.durationSec ?? null,
        sortOrder: req.body.sortOrder ?? 0,
        isPreview: !!req.body.isPreview,
      },
    });

    return res.status(201).json({ message: "Video added.", video });
  } catch (err) {
    logger.error("addCourseVideo error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to add video." });
  }
}

// POST /api/teacher/courses/:courseId/videos/upload
// Multipart counterpart to addCourseVideo — use this for real
// lecture-length videos. multer (videoUpload.middleware.js) has
// already streamed the file to a TEMP folder by the time this runs.
// From here we either push it up to R2/S3 (if configured) or move
// it into the permanent local uploads folder (fallback, same as
// the original behavior) — either way the temp copy is cleaned up.
async function uploadCourseVideo(req, res) {
  try {
    const teacherId = req.user.userId;
    const { courseId } = req.params;
    const course = await prisma.course.findFirst({ where: { id: courseId, teacherId } });
    if (!course) {
      if (req.file) fs.unlink(req.file.path, () => {}); // don't leave orphaned files for a course that isn't theirs
      return res.status(404).json({ error: "Course not found." });
    }
    if (!(await requireApprovedTeacher(teacherId))) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: "Teacher verification must be approved before uploading course videos." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No video file received (field name must be \"video\")." });
    }
    if (!req.body.title || !req.body.title.trim()) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Video title is required." });
    }

    const relativeFolder = `course-videos/${courseId}`;
    const filename = req.file.filename;
    const storageKey = `${relativeFolder}/${filename}`;
    let videoUrl;

    if (s3Client) {
      // Stream the temp file straight up to R2/S3 — Upload (from
      // @aws-sdk/lib-storage) handles multipart upload internally,
      // so this stays memory-flat even for a 250MB video.
      const fileStream = fs.createReadStream(req.file.path);
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: BUCKET,
          Key: storageKey,
          Body: fileStream,
          ContentType: req.file.mimetype,
        },
      });
      await upload.done();
      fs.unlink(req.file.path, () => {}); // temp copy no longer needed once it's in R2/S3
      videoUrl = PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/${storageKey}` : `/uploads/${storageKey}`;
    } else {
      // Fallback: move out of the temp folder into the permanent
      // local uploads folder — identical to the pre-S3 behavior.
      const permanentFolder = path.join(UPLOAD_ROOT, relativeFolder);
      fs.mkdirSync(permanentFolder, { recursive: true });
      fs.renameSync(req.file.path, path.join(permanentFolder, filename));
      videoUrl = `/uploads/${storageKey}`;
    }

    const video = await prisma.courseVideo.create({
      data: {
        courseId,
        title: req.body.title.trim(),
        description: req.body.description?.trim() || null,
        videoUrl,
        storageKey,
        durationSec: req.body.durationSec ? Number(req.body.durationSec) : null,
        sortOrder: req.body.sortOrder ? Number(req.body.sortOrder) : 0,
        isPreview: req.body.isPreview === "true" || req.body.isPreview === true,
      },
    });

    return res.status(201).json({ message: "Video uploaded.", video });
  } catch (err) {
    logger.error("uploadCourseVideo error:", err);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(err.status || 500).json({ error: err.message || "Failed to upload video." });
  }
}

// GET /api/teacher/enrollment-requests
// Every PENDING request across all of this teacher's courses,
// with the student's name, email, and the contact number they
// submitted — so the teacher can reach out and confirm payment.
async function getEnrollmentRequests(req, res) {
  try {
    const teacherId = req.user.userId;

    const requests = await prisma.enrollment.findMany({
      where: {
        status: "PENDING",
        course: { teacherId },
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true, price: true } },
      },
      orderBy: { enrolledAt: "asc" }, // oldest request first
    });

    const results = requests.map((r) => ({
      enrollmentId: r.id,
      studentName: r.student.name,
      studentEmail: r.student.email,
      contactNumber: r.contactNumber,
      courseTitle: r.course.title,
      coursePrice: r.course.price,
      requestedAt: r.enrolledAt,
    }));

    return res.json({ requests: results });
  } catch (err) {
    logger.error("Teacher getEnrollmentRequests error:", err);
    return res.status(500).json({ error: "Failed to load enrollment requests." });
  }
}

// POST /api/teacher/enrollment-requests/:enrollmentId/respond
// Body: { action: "approve" | "reject" }
async function respondToRequest(req, res) {
  try {
    const teacherId = req.user.userId;
    const { enrollmentId } = req.params;
    const { action } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Action must be 'approve' or 'reject'." });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true, payments: true },
    });

    if (!enrollment || enrollment.course.teacherId !== teacherId) {
      return res.status(404).json({ error: "Enrollment request not found." });
    }

    const hasPaidPayment = enrollment.payments.some((p) => p.status === "PAID");
    if (action === "approve" && enrollment.course.price > 0 && !hasPaidPayment) {
      return res.status(400).json({ error: "Paid courses can only be approved after Razorpay verifies payment." });
    }

    const updated = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        respondedAt: new Date(),
      },
    });

    return res.json({ message: `Request ${action === "approve" ? "approved" : "rejected"}.`, enrollment: updated });
  } catch (err) {
    logger.error("Teacher respondToRequest error:", err);
    return res.status(500).json({ error: "Failed to respond to enrollment request." });
  }
}

module.exports = { getOverview, createCourse, getEnrollmentRequests, respondToRequest, listCourseVideos, addCourseVideo, uploadCourseVideo };
