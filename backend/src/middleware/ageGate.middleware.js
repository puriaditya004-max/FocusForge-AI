// ---------------------------------------------------------
// middleware/ageGate.middleware.js
// DPDP Act 2023 requires verifiable parental consent before
// processing a minor's personal data for higher-stakes actions
// (course payments, AI Mentor usage, etc). This is stricter
// than the existing parent-link feature, which today is just
// student-initiated and not tied to any consent requirement.
//
// Usage: place after requireAuth on any route that should be
// blocked for minors until a parent has an APPROVED link:
//
//   router.post("/courses/:id/order", requireAuth, requireParentalConsentIfMinor, createCoursePaymentOrder);
// ---------------------------------------------------------
const prisma = require("../config/db");
const { isMinor } = require("../utils/age.util");

async function requireParentalConsentIfMinor(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, dateOfBirth: true },
    });

    if (!user) {
      return res.status(401).json({ error: "Not authenticated. Please log in." });
    }

    // No DOB on file yet — force the user to complete their profile
    // before this action, rather than silently letting an unknown-age
    // account through.
    if (!user.dateOfBirth) {
      return res.status(403).json({
        error: "Please add your date of birth in Settings before continuing.",
        reason: "DOB_MISSING",
      });
    }

    if (!isMinor(user.dateOfBirth)) {
      return next();
    }

    const approvedLink = await prisma.studentParentLink.findFirst({
      where: { studentId: user.id, status: "APPROVED" },
    });

    if (!approvedLink) {
      return res.status(403).json({
        error:
          "This account is under 18. A parent must link and approve this account before continuing.",
        reason: "PARENTAL_CONSENT_REQUIRED",
      });
    }

    return next();
  } catch (err) {
    return res.status(500).json({ error: "Could not verify account eligibility. Please try again." });
  }
}

module.exports = { requireParentalConsentIfMinor };
