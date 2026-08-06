// ---------------------------------------------------------
// roadmap.routes.js — API endpoints for Smart Timetable
// ---------------------------------------------------------
const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  getRoadmap,
  updateWeekStatus,
} = require("../controllers/roadmap.controller");

const router = express.Router();

// All roadmap routes require the user to be logged in
router.use(requireAuth);

router.get("/", getRoadmap);
router.patch("/:week/status", updateWeekStatus);

module.exports = router;