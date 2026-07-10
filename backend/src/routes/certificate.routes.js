// ---------------------------------------------------------
// certificate.routes.js — API endpoints for Certificate Exam
// ---------------------------------------------------------
const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { getQuestions, getStatus, submitExam } = require("../controllers/certificate.controller");

const router = express.Router();

router.use(requireAuth);

router.get("/questions", getQuestions);
router.get("/status", getStatus);
router.post("/submit", submitExam);

module.exports = router;