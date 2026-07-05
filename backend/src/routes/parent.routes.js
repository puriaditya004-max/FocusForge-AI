// ---------------------------------------------------------
// routes/parent.routes.js — Parent Panel
// Only accessible to logged-in users with role = PARENT
// ---------------------------------------------------------

const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { getOverview, linkStudent } = require("../controllers/parent.controller");

router.get("/overview", requireAuth, requireRole("PARENT"), getOverview);
router.post("/link", requireAuth, requireRole("PARENT"), linkStudent);

module.exports = router;