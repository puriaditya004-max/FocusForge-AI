// ---------------------------------------------------------
// routes/marketplace.routes.js — Classes Marketplace
// Only accessible to logged-in STUDENT users
// ---------------------------------------------------------

const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { requireFeature } = require("../middleware/requireFeature.middleware");
const { browseCourses, enrollInCourse, getMyCourses, getCourseVideos } = require("../controllers/marketplace.controller");

router.use(requireFeature("marketplace"));

router.get("/courses", requireAuth, requireRole("STUDENT"), browseCourses);
router.post("/courses/:courseId/enroll", requireAuth, requireRole("STUDENT"), enrollInCourse);
router.get("/my-courses", requireAuth, requireRole("STUDENT"), getMyCourses);
router.get("/courses/:courseId/videos", requireAuth, requireRole("STUDENT"), getCourseVideos);

module.exports = router;
