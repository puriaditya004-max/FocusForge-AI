const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { teacherReviewSchema } = require("../validators/teacher.validator");
const {
  listTeacherVerifications,
  reviewTeacherVerification,
} = require("../controllers/verification.controller");
const { getAdminOverview, listRefunds, listStudyRoomReports, resolveStudyRoomReport, listPayouts } = require("../controllers/admin.controller");
const { processRefund, retryPayout } = require("../controllers/payment.controller");
const { listDigitalIds, revokeDigitalId } = require("../controllers/digitalid.controller");

router.get("/overview", requireAuth, requireRole("ADMIN"), getAdminOverview);

router.get("/teacher-verifications", requireAuth, requireRole("ADMIN"), listTeacherVerifications);
router.post("/teacher-verifications/:id/review", requireAuth, requireRole("ADMIN"), validate(teacherReviewSchema), reviewTeacherVerification);

router.get("/refunds", requireAuth, requireRole("ADMIN"), listRefunds);
// Kept here too (in addition to /api/payments/refunds/:refundId/process) so the
// whole Admin Panel surface lives under /api/admin/* for the frontend.
router.post("/refunds/:refundId/process", requireAuth, requireRole("ADMIN"), processRefund);

router.get("/studyroom-reports", requireAuth, requireRole("ADMIN"), listStudyRoomReports);
router.post("/studyroom-reports/:id/resolve", requireAuth, requireRole("ADMIN"), resolveStudyRoomReport);

router.get("/digital-ids", requireAuth, requireRole("ADMIN"), listDigitalIds);
router.post("/digital-ids/:id/revoke", requireAuth, requireRole("ADMIN"), revokeDigitalId);

router.get("/payouts", requireAuth, requireRole("ADMIN"), listPayouts);
router.post("/payments/:paymentId/retry-payout", requireAuth, requireRole("ADMIN"), retryPayout);

module.exports = router;
