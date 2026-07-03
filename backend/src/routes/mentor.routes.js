// ===========================================================
// AI Mentor Routes
// ===========================================================

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth.middleware");
const { sendMessage, getHistory } = require("../controllers/mentor.controller");

// GET /api/mentor/history — load full chat history for logged-in student
router.get("/history", requireAuth, getHistory);

// POST /api/mentor/message — send a message, get AI reply back
router.post("/message", requireAuth, sendMessage);

module.exports = router;