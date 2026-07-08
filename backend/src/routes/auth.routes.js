const express = require("express");
const router = express.Router();
const { signup, login, logout, me } = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { authLimiter } = require("../middleware/rateLimiter.middleware");
const validate = require("../middleware/validate.middleware");
const { signupSchema, loginSchema } = require("../validators/auth.validator");

router.post("/signup", authLimiter, validate(signupSchema), signup);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

module.exports = router;