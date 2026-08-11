// ---------------------------------------------------------
// settings.routes.js — API endpoints for Settings page
// ---------------------------------------------------------
const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { getSettings, updateSettings, resetProgress } = require("../controllers/settings.controller");

const router = express.Router();

router.use(requireAuth);

router.get("/", getSettings);
router.patch("/", updateSettings);
router.post("/reset-progress", resetProgress);

module.exports = router;
