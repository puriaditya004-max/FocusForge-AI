// ---------------------------------------------------------
// youtube.routes.js - real-time YouTube search and recommendations
// ---------------------------------------------------------
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { searchYoutube, getRecommendations } = require("../controllers/youtube.controller");

router.use(requireAuth);

router.get("/search", searchYoutube);
router.get("/recommendations", getRecommendations);

module.exports = router;
