// ---------------------------------------------------------
// roadmap.routes.js — API endpoints for Smart Timetable
// ---------------------------------------------------------
const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { aiDailyLimiter, aiBurstLimiter } = require("../middleware/rateLimiter.middleware");
const { generateRoadmapSchema, importRoadmapSchema } = require("../validators/roadmap.validator");
const {
  getRoadmap,
  updateWeekStatus,
  generateRoadmap,
  importRoadmap,
  suggestToday,
} = require("../controllers/roadmap.controller");

const router = express.Router();

// All roadmap routes require the user to be logged in
router.use(requireAuth);

router.get("/", getRoadmap);
router.patch("/:week/status", updateWeekStatus);

// POST /api/roadmap/generate — AI Smart Timetable generator
router.post(
  "/generate",
  aiBurstLimiter,
  aiDailyLimiter,
  validate(generateRoadmapSchema),
  generateRoadmap
);

// POST /api/roadmap/import — import timetable from PDF/image
router.post(
  "/import",
  aiBurstLimiter,
  aiDailyLimiter,
  validate(importRoadmapSchema),
  importRoadmap
);

// GET /api/roadmap/suggest-today?hours=6 — rule-based topic picker for Today's Plan
router.get("/suggest-today", suggestToday);

module.exports = router;
