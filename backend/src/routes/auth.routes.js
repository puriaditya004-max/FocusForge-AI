const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  verifyEmail,
  resendEmailVerification,
  requestPasswordReset,
  resetPassword,
  logout,
  me,
  requestOtp,
  verifyOtp,
  deleteAccount,
} = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { authLimiter } = require("../middleware/rateLimiter.middleware");
const validate = require("../middleware/validate.middleware");
const {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  resendEmailVerificationSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  requestOtpSchema,
  verifyOtpSchema,
  deleteAccountSchema,
} = require("../validators/auth.validator");

router.post("/signup", authLimiter, validate(signupSchema), signup);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/email/verify", authLimiter, validate(verifyEmailSchema), verifyEmail);
router.post("/email/resend", authLimiter, validate(resendEmailVerificationSchema), resendEmailVerification);
router.post("/forgot-password/request", authLimiter, validate(requestPasswordResetSchema), requestPasswordReset);
router.post("/forgot-password/reset", authLimiter, validate(resetPasswordSchema), resetPassword);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.delete("/me", requireAuth, authLimiter, validate(deleteAccountSchema), deleteAccount);
router.post("/otp/request", requireAuth, authLimiter, validate(requestOtpSchema), requestOtp);
router.post("/otp/verify", requireAuth, authLimiter, validate(verifyOtpSchema), verifyOtp);

module.exports = router;
