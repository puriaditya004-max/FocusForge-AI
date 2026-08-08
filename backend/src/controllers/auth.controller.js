// ---------------------------------------------------------
// controllers/auth.controller.js
// signup, login, logout, and "who am I" (me).
//
// Signup now accepts an optional `role` field:
//   "STUDENT" (default) | "PARENT" | "TEACHER"
// This is what powers role-based dashboards — the same
// login page/app, but each role lands on a different home
// screen after logging in.
//
// NOTE: name/email/password/role are already validated and
// trimmed/lowercased by the zod schema + validate middleware
// upstream (see validators/auth.validator.js), so this file
// only needs to worry about business logic, not input shape.
// ---------------------------------------------------------
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const logger = require("../utils/logger");
const { generateOtp, hashOtp, verifyOtpHash, deliverOtp } = require("../utils/otp");
const { isMinor } = require("../utils/age.util");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const VALID_ROLES = ["STUDENT", "PARENT", "TEACHER"];

function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

// Never send the password hash back to the frontend
function toSafeUser(user) {
  const { passwordHash, ...safe } = user;
  // Lets the frontend show a "parent consent required" gate without
  // re-deriving age from a raw DOB string on every page.
  safe.isMinor = isMinor(user.dateOfBirth);
  return safe;
}

function normalizeOtpTarget(user, channel, target) {
  if (channel === "EMAIL") return (target || user.email || "").toLowerCase().trim();
  return (target || user.mobileNumber || "").trim();
}

// POST /api/auth/signup
async function signup(req, res) {
  try {
    const { name, email, password, role, dateOfBirth, mobileNumber } = req.body;
    const safeRole = VALID_ROLES.includes(role) ? role : "STUDENT";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Deliberately generic — doesn't confirm/deny which part
      // of an existing account matched, just that signup can't proceed.
      return res.status(409).json({ error: "This email can't be used to create an account." });
    }

    const passwordHash = await bcrypt.hash(password, 12); // cost factor 12 — stronger than the old default of 10

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: safeRole,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        mobileNumber: mobileNumber || null,
      },
    });

    const token = signToken(user);
    res.cookie("token", token, COOKIE_OPTIONS);

    return res.status(201).json({ user: toSafeUser(user), token });
  } catch (err) {
    logger.error("Signup error:", err);
    return res.status(500).json({ error: "Something went wrong while creating your account." });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    // Same generic message whether the email doesn't exist OR the
    // password is wrong — prevents attackers from using this endpoint
    // to discover which emails have accounts (user enumeration).
    const genericError = () => res.status(401).json({ error: "Invalid email or password." });

    if (!user) return genericError();

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return genericError();

    const token = signToken(user);
    res.cookie("token", token, COOKIE_OPTIONS);

    return res.json({ user: toSafeUser(user), token });
  } catch (err) {
    logger.error("Login error:", err);
    return res.status(500).json({ error: "Something went wrong while logging in." });
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  res.clearCookie("token", COOKIE_OPTIONS);
  return res.json({ message: "Logged out successfully." });
}

// GET /api/auth/me
async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    logger.error("Me error:", err);
    return res.status(500).json({ error: "Something went wrong." });
  }
}

// POST /api/auth/otp/request
async function requestOtp(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: "User not found." });

    const { channel, target } = req.body;
    const normalizedTarget = normalizeOtpTarget(user, channel, target);
    if (!normalizedTarget) {
      return res.status(400).json({ error: channel === "EMAIL" ? "Email is required." : "Mobile number is required." });
    }

    const code = generateOtp();
    const challenge = await prisma.otpChallenge.create({
      data: {
        userId: user.id,
        channel,
        target: normalizedTarget,
        codeHash: hashOtp(code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await deliverOtp({ channel, target: normalizedTarget, code });

    return res.status(201).json({
      message: `OTP sent to ${channel === "EMAIL" ? "email" : "mobile"}.`,
      challengeId: challenge.id,
      devCode: process.env.NODE_ENV === "production" ? undefined : code,
    });
  } catch (err) {
    logger.error("requestOtp error:", err);
    return res.status(500).json({ error: "Failed to send OTP." });
  }
}

// POST /api/auth/otp/verify
async function verifyOtp(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: "User not found." });

    const { channel, code, target } = req.body;
    const normalizedTarget = normalizeOtpTarget(user, channel, target);
    const challenge = await prisma.otpChallenge.findFirst({
      where: {
        userId: user.id,
        channel,
        target: normalizedTarget,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge) return res.status(400).json({ error: "OTP expired or not found." });
    if (challenge.attempts >= challenge.maxAttempts) {
      return res.status(429).json({ error: "Too many OTP attempts. Request a new code." });
    }

    if (!verifyOtpHash(code, challenge.codeHash)) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      return res.status(400).json({ error: "Invalid OTP." });
    }

    const now = new Date();
    const updateData =
      channel === "EMAIL"
        ? { emailVerifiedAt: now }
        : { mobileNumber: normalizedTarget, mobileVerifiedAt: now };

    const [updated] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: updateData }),
      prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } }),
    ]);

    return res.json({ message: "OTP verified.", user: toSafeUser(updated) });
  } catch (err) {
    logger.error("verifyOtp error:", err);
    return res.status(500).json({ error: "Failed to verify OTP." });
  }
}

module.exports = { signup, login, logout, me, requestOtp, verifyOtp };
