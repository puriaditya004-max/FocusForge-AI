// ---------------------------------------------------------
// focus.routes.js — API endpoints for Focus Mode sessions
// ---------------------------------------------------------
const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { requirePremiumAccess } = require("../middleware/subscription.middleware");
const { createSession, getSessions } = require("../controllers/focus.controller");

const router = express.Router();

router.use(requireAuth);

router.get("/", getSessions);
router.post("/", requirePremiumAccess, createSession);

module.exports = router;
