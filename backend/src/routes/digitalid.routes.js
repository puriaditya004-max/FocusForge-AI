const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth.middleware");
const { getMyCard, verifyCard } = require("../controllers/digitalid.controller");

// Own card — auto-generates on first call if identity is verified.
router.get("/me", requireAuth, getMyCard);

// Public — what a QR-code scan resolves to. No auth on purpose:
// this is meant to be checked by anyone scanning the card (a
// teacher, a security guard, etc.), not just the card holder.
router.get("/verify/:token", verifyCard);

module.exports = router;
