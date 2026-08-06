// ---------------------------------------------------------
// savedvideo.routes.js — API endpoints for saved videos
// ---------------------------------------------------------
const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { getSavedVideos, saveVideo, unsaveVideo } = require("../controllers/savedvideo.controller");

const router = express.Router();

router.use(requireAuth);

router.get("/", getSavedVideos);
router.post("/", saveVideo);
router.delete("/:videoId", unsaveVideo);

module.exports = router;