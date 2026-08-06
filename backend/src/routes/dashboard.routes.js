// ---------------------------------------------------------
// routes/dashboard.routes.js
// ---------------------------------------------------------
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { getDashboard } = require("../controllers/dashboard.controller");

router.use(requireAuth);

router.get("/", getDashboard);

module.exports = router;