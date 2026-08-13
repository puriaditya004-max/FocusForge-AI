// ---------------------------------------------------------
// digitalid.controller.js — Student Digital ID card.
//
// The blueprint's Auth & Trust Layer calls for an auto-generated
// Digital ID card once a student's identity has actually been
// verified (email or mobile OTP confirmed) — not on signup alone,
// since role/identity is otherwise self-asserted.
//
// Design:
//   - cardNumber: human-readable, printed on the card (e.g. FF-STU-8K3F9QRT)
//   - verifyToken: separate opaque random value, only ever exposed
//     inside the QR code payload — used by the public verify
//     endpoint so the card can't be looked up from the printed
//     number alone (avoids enumeration of the human-readable ID)
// ---------------------------------------------------------
const crypto = require("crypto");
const prisma = require("../config/db");
const logger = require("../utils/logger");
const { formatSubscription } = require("./subscription.controller");

function generateCardNumber(role) {
  const prefix = role === "TEACHER" ? "TCH" : role === "PARENT" ? "PAR" : "STU";
  const random = crypto.randomBytes(5).toString("hex").toUpperCase().slice(0, 8);
  return `FF-${prefix}-${random}`;
}

function generateVerifyToken() {
  return crypto.randomBytes(24).toString("base64url");
}

// GET /api/digital-id/me
// Returns the caller's own Digital ID card, auto-generating one
// on first request if their identity is verified and they don't
// have one yet.
const getMyCard = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isVerified = !!(user.emailVerifiedAt || user.mobileVerifiedAt);
    if (!isVerified) {
      return res.status(403).json({
        error: "Verify your email or mobile number before your Digital ID can be issued.",
        code: "IDENTITY_NOT_VERIFIED",
      });
    }

    if (user.role === "STUDENT" && !user.onboardingCompletedAt) {
      return res.status(403).json({
        error: "Complete onboarding before your Digital ID can be issued.",
        code: "ONBOARDING_REQUIRED",
      });
    }

    let card = await prisma.digitalId.findUnique({ where: { userId } });

    if (!card) {
      // Retry on the (extremely unlikely) chance of a cardNumber/token collision.
      let attempts = 0;
      while (!card) {
        attempts++;
        try {
          card = await prisma.digitalId.create({
            data: {
              userId,
              cardNumber: generateCardNumber(user.role),
              verifyToken: generateVerifyToken(),
            },
          });
        } catch (err) {
          if (err.code === "P2002" && attempts < 5) {
            continue; // unique clash — regenerate and retry
          }
          throw err;
        }
      }
    }

    return res.status(200).json({
      card: {
        cardNumber: card.cardNumber,
        verifyToken: card.verifyToken,
        status: card.status,
        issuedAt: card.issuedAt,
        revokedAt: card.revokedAt,
      },
      holder: {
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        dateOfBirth: user.dateOfBirth,
      },
      subscription: formatSubscription(user.subscription),
    });
  } catch (err) {
    logger.error("getMyCard error:", err);
    return res.status(500).json({ error: "Failed to fetch Digital ID card." });
  }
};

// GET /api/digital-id/verify/:token
// PUBLIC (no auth) — what a QR-code scan resolves to. Returns only
// the minimum needed to confirm the card is real and current;
// never returns email, mobile, DOB, or any other PII.
const verifyCard = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ valid: false, error: "Missing verification token." });
    }

    const card = await prisma.digitalId.findUnique({
      where: { verifyToken: token },
      include: { user: { select: { name: true, role: true, subscription: true } } },
    });

    if (!card) {
      return res.status(404).json({ valid: false, error: "No Digital ID found for this code." });
    }

    if (card.status !== "ACTIVE") {
      return res.status(200).json({
        valid: false,
        status: card.status,
        error: "This Digital ID has been revoked.",
      });
    }

    return res.status(200).json({
      valid: true,
      status: card.status,
      cardNumber: card.cardNumber,
      name: card.user.name,
      role: card.user.role,
      issuedAt: card.issuedAt,
      subscription: formatSubscription(card.user.subscription),
    });
  } catch (err) {
    logger.error("verifyCard error:", err);
    return res.status(500).json({ valid: false, error: "Failed to verify Digital ID." });
  }
};

// GET /api/admin/digital-ids?status=ACTIVE
// ADMIN — list issued cards for oversight.
const listDigitalIds = async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};

    const cards = await prisma.digitalId.findMany({
      where,
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { issuedAt: "desc" },
      take: 200,
    });

    return res.status(200).json({
      cards: cards.map((c) => ({
        id: c.id,
        cardNumber: c.cardNumber,
        status: c.status,
        issuedAt: c.issuedAt,
        revokedAt: c.revokedAt,
        holderName: c.user.name,
        holderEmail: c.user.email,
        holderRole: c.user.role,
      })),
    });
  } catch (err) {
    logger.error("listDigitalIds error:", err);
    return res.status(500).json({ error: "Failed to list Digital IDs." });
  }
};

// POST /api/admin/digital-ids/:id/revoke
// ADMIN — revoke a compromised/incorrectly-issued card. The
// student can still request a fresh one isn't auto-supported here
// on purpose (re-issue is a deliberate separate admin action, not
// self-service, since revocation usually follows a trust incident).
const revokeDigitalId = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    const card = await prisma.digitalId.findUnique({ where: { id } });
    if (!card) {
      return res.status(404).json({ error: "Digital ID not found." });
    }
    if (card.status === "REVOKED") {
      return res.status(400).json({ error: "This Digital ID is already revoked." });
    }

    const updated = await prisma.digitalId.update({
      where: { id },
      data: { status: "REVOKED", revokedAt: new Date(), revokedById: adminId },
    });

    return res.status(200).json({ message: "Digital ID revoked.", card: updated });
  } catch (err) {
    logger.error("revokeDigitalId error:", err);
    return res.status(500).json({ error: "Failed to revoke Digital ID." });
  }
};

module.exports = {
  getMyCard,
  verifyCard,
  listDigitalIds,
  revokeDigitalId,
};
