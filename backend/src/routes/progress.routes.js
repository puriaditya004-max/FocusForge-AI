// ---------------------------------------------------------
// progress.routes.js — API endpoint for Progress dashboard
// ---------------------------------------------------------
const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { getStats } = require("../controllers/progress.controller");

const router = express.Router();

router.use(requireAuth);

router.get("/stats", getStats);

module.exports = router;