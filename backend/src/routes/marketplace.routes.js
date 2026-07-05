// ---------------------------------------------------------
// routes/marketplace.routes.js — Classes Marketplace
// Only accessible to logged-in STUDENT users
// ---------------------------------------------------------

const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { browseCourses, enrollInCourse, getMyCourses } = require("../controllers/marketplace.controller");

router.get("/courses", requireAuth, requireRole("STUDENT"), browseCourses);
router.post("/courses/:courseId/enroll", requireAuth, requireRole("STUDENT"), enrollInCourse);
router.get("/my-courses", requireAuth, requireRole("STUDENT"), getMyCourses);

module.exports = router;