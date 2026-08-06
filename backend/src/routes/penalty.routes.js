// ---------------------------------------------------------
// penalty.routes.js — API endpoints for Penalties page
// ---------------------------------------------------------
const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { getPenalties, markRedeemed } = require("../controllers/penalty.controller");

const router = express.Router();

router.use(requireAuth);

router.get("/", getPenalties);
router.patch("/:id/redeem", markRedeemed);

module.exports = router;