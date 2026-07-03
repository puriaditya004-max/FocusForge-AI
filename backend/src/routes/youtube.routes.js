// ---------------------------------------------------------
// youtube.routes.js — real-time YouTube search endpoint
// ---------------------------------------------------------
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { searchYoutube } = require("../controllers/youtube.controller");

// Protect it just like every other feature route — only
// logged-in students can use the search.
router.use(requireAuth);

// GET /api/youtube/search?q=...
router.get("/search", searchYoutube);

module.exports = router;