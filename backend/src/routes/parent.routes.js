// ---------------------------------------------------------
// routes/parent.routes.js — Parent Panel
// Only accessible to logged-in users with role = PARENT
// ---------------------------------------------------------

const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const {
  getOverview,
  linkStudent,
  updateChildGoal,
  getPendingRequests,
  respondToRequest,
} = require("../controllers/parent.controller");

// Parent-side: request a link, view approved children's data
router.get("/overview", requireAuth, requireRole("PARENT"), getOverview);
router.post("/link", requireAuth, requireRole("PARENT"), linkStudent);
router.patch("/children/:studentId/goal", requireAuth, requireRole("PARENT"), updateChildGoal);

// Student-side: the actual consent step — see and decide on incoming requests
router.get("/requests/pending", requireAuth, requireRole("STUDENT"), getPendingRequests);
router.post("/requests/:id/respond", requireAuth, requireRole("STUDENT"), respondToRequest);

module.exports = router;
