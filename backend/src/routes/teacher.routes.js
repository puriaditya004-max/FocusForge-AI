const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const {
  getOverview,
  createCourse,
  getEnrollmentRequests,
  respondToRequest,
} = require("../controllers/teacher.controller");

router.get("/overview", requireAuth, requireRole("TEACHER"), getOverview);
router.post("/courses", requireAuth, requireRole("TEACHER"), createCourse);
router.get("/enrollment-requests", requireAuth, requireRole("TEACHER"), getEnrollmentRequests);
router.post("/enrollment-requests/:enrollmentId/respond", requireAuth, requireRole("TEACHER"), respondToRequest);

module.exports = router;