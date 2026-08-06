const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { teacherVerificationSchema, courseVideoSchema } = require("../validators/teacher.validator");
const { uploadSingleVideo } = require("../middleware/videoUpload.middleware");
const {
  getOverview,
  createCourse,
  getEnrollmentRequests,
  respondToRequest,
  listCourseVideos,
  addCourseVideo,
  uploadCourseVideo,
} = require("../controllers/teacher.controller");
const {
  getTeacherVerification,
  submitTeacherVerification,
} = require("../controllers/verification.controller");

router.get("/overview", requireAuth, requireRole("TEACHER"), getOverview);
router.post("/courses", requireAuth, requireRole("TEACHER"), createCourse);
router.get("/verification", requireAuth, requireRole("TEACHER"), getTeacherVerification);
router.post("/verification", requireAuth, requireRole("TEACHER"), validate(teacherVerificationSchema), submitTeacherVerification);
router.get("/courses/:courseId/videos", requireAuth, requireRole("TEACHER"), listCourseVideos);
router.post("/courses/:courseId/videos", requireAuth, requireRole("TEACHER"), validate(courseVideoSchema), addCourseVideo);
// Multipart streaming upload — use for real lecture-length video files
// (the JSON route above is base64 and capped much smaller, see teacher.controller.js).
router.post("/courses/:courseId/videos/upload", requireAuth, requireRole("TEACHER"), uploadSingleVideo, uploadCourseVideo);
router.get("/enrollment-requests", requireAuth, requireRole("TEACHER"), getEnrollmentRequests);
router.post("/enrollment-requests/:enrollmentId/respond", requireAuth, requireRole("TEACHER"), respondToRequest);

module.exports = router;
