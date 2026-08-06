// ---------------------------------------------------------
// reward.routes.js — API endpoints for Rewards page
// ---------------------------------------------------------
const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { getRewards, toggleChallenge } = require("../controllers/reward.controller");

const router = express.Router();

router.use(requireAuth);

router.get("/", getRewards);
router.patch("/challenges/:id/toggle", toggleChallenge);

module.exports = router;