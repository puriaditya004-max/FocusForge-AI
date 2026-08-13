const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const logger = require("../utils/logger");
const { OTP_TTL_MS, generateOtp, hashOtp, verifyOtpHash, deliverOtp } = require("../utils/otp");
const { isMinor } = require("../utils/age.util");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const VALID_ROLES = ["STUDENT", "PARENT", "TEACHER"];
const OTP_PURPOSES = {
  VERIFY_ACCOUNT: "VERIFY_ACCOUNT",
  DIGITAL_ID: "DIGITAL_ID",
  RESET_PASSWORD: "RESET_PASSWORD",
};

function signToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function signVerificationToken(user, purpose = OTP_PURPOSES.VERIFY_ACCOUNT) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      purpose,
      type: "email_verification",
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

function readVerificationToken(token, expectedPurpose = OTP_PURPOSES.VERIFY_ACCOUNT) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload?.type !== "email_verification" || payload?.purpose !== expectedPurpose || !payload?.userId) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function toSafeUser(user) {
  const { passwordHash, ...safe } = user;
  safe.isMinor = isMinor(user.dateOfBirth);
  return safe;
}

function normalizeEmail(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeOtpTarget(user, channel, target) {
  if (channel === "EMAIL") return normalizeEmail(target || user.email || "");
  const rawMobile = (target || user.mobileNumber || "").trim();
  const compactMobile = rawMobile.replace(/[\s()-]/g, "");
  if (/^\d{10}$/.test(compactMobile)) return `+91${compactMobile}`;
  if (/^91\d{10}$/.test(compactMobile)) return `+${compactMobile}`;
  if (/^00\d{10,15}$/.test(compactMobile)) return `+${compactMobile.slice(2)}`;
  return compactMobile;
}

function maskTarget(channel, target) {
  if (channel === "EMAIL") {
    const [name = "", domain = ""] = String(target || "").split("@");
    return domain ? `${name.slice(0, 2)}***@${domain}` : "***";
  }
  return String(target || "").replace(/^(\+?\d{2})\d+(\d{2})$/, "$1******$2");
}

async function createOtpChallenge({ user, channel, target, purpose, recipientName }) {
  const code = generateOtp();
  const now = new Date();

  await prisma.otpChallenge.updateMany({
    where: {
      userId: user.id,
      channel,
      target,
      purpose,
      consumedAt: null,
    },
    data: { consumedAt: now },
  });

  const challenge = await prisma.otpChallenge.create({
    data: {
      userId: user.id,
      channel,
      target,
      purpose,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  try {
    await deliverOtp({ channel, target, code, recipientName: recipientName || user.name });
  } catch (err) {
    await prisma.otpChallenge.delete({ where: { id: challenge.id } }).catch(() => {});
    throw err;
  }

  return {
    challenge,
    devCode: process.env.NODE_ENV === "production" ? undefined : code,
  };
}

async function verifyOtpChallenge({ user, channel, target, code, purpose }) {
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      userId: user.id,
      channel,
      target,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    const err = new Error("OTP expired or not found.");
    err.status = 400;
    throw err;
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    const err = new Error("Too many OTP attempts. Request a new code.");
    err.status = 429;
    throw err;
  }

  if (!verifyOtpHash(code, challenge.codeHash)) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    const err = new Error("Invalid OTP.");
    err.status = 400;
    throw err;
  }

  return challenge;
}

function setAuthCookie(res, user) {
  res.cookie("token", signToken(user), COOKIE_OPTIONS);
}

function generateCardNumber(role) {
  const prefix = role === "TEACHER" ? "TCH" : role === "PARENT" ? "PAR" : "STU";
  const random = crypto.randomBytes(5).toString("hex").toUpperCase().slice(0, 8);
  return `FF-${prefix}-${random}`;
}

function generateVerifyToken() {
  return crypto.randomBytes(24).toString("base64url");
}

async function issueDigitalIdForUser(userId, role) {
  const existing = await prisma.digitalId.findUnique({ where: { userId } });
  if (existing) return existing;

  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    try {
      return await prisma.digitalId.create({
        data: {
          userId,
          cardNumber: generateCardNumber(role),
          verifyToken: generateVerifyToken(),
        },
      });
    } catch (err) {
      if (err.code === "P2002" && attempts < 5) continue;
      throw err;
    }
  }
  throw new Error("Failed to issue Digital ID.");
}

async function sendAccountVerification(user) {
  const result = await createOtpChallenge({
    user,
    channel: "EMAIL",
    target: user.email,
    purpose: OTP_PURPOSES.VERIFY_ACCOUNT,
    recipientName: user.name,
  });

  return {
    verificationToken: signVerificationToken(user, OTP_PURPOSES.VERIFY_ACCOUNT),
    devCode: result.devCode,
  };
}

async function signup(req, res) {
  try {
    const { name, email, role } = req.body;
    const safeRole = VALID_ROLES.includes(role) ? role : "STUDENT";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "This email can't be used to create an account." });
    }

    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: safeRole,
      },
    });

    const verification = await sendAccountVerification(user);

    return res.status(201).json({
      code: "EMAIL_VERIFICATION_SENT",
      message: "Account created. Verify your email to continue.",
      user: toSafeUser(user),
      verificationToken: verification.verificationToken,
      devCode: verification.devCode,
    });
  } catch (err) {
    logger.error("Signup error:", err);
    return res.status(err.status || 500).json({
      error: err.status === 503 ? err.message : "Something went wrong while creating your account.",
    });
  }
}

async function login(req, res) {
  try {
    const { identifier, password } = req.body;
    const normalizedIdentifier = String(identifier || "").trim();
    const genericError = () => res.status(401).json({ error: "Invalid Digital ID or password." });

    let user = null;
    const card = await prisma.digitalId.findUnique({
      where: { cardNumber: normalizedIdentifier.toUpperCase() },
      include: { user: { include: { digitalId: true } } },
    });

    if (card?.user) {
      user = card.user;
    } else if (normalizedIdentifier.includes("@")) {
      const emailUser = await prisma.user.findUnique({
        where: { email: normalizeEmail(normalizedIdentifier) },
        include: { digitalId: true },
      });

      if (emailUser && (emailUser.role !== "STUDENT" || !emailUser.onboardingCompletedAt)) {
        user = emailUser;
      }
    }

    if (!user) return genericError();

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return genericError();

    if (!user.emailVerifiedAt) {
      const verification = await sendAccountVerification(user);
      return res.status(403).json({
        code: "EMAIL_VERIFICATION_REQUIRED",
        message: "Verify your email to continue.",
        verificationToken: verification.verificationToken,
        email: user.email,
        devCode: verification.devCode,
      });
    }

    if (user.role === "STUDENT" && !user.onboardingCompletedAt) {
      setAuthCookie(res, user);
      return res.status(403).json({
        code: "ONBOARDING_REQUIRED",
        message: "Complete onboarding to receive your Digital ID.",
        user: toSafeUser(user),
      });
    }

    setAuthCookie(res, user);
    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    logger.error("Login error:", err);
    return res.status(err.status || 500).json({
      error: err.status === 503 ? err.message : "Something went wrong while logging in.",
    });
  }
}

async function completeOnboarding(req, res) {
  try {
    const userId = req.user.userId;
    const { preparationTrack, preparationOther, dateOfBirth, avatarUrl, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { digitalId: true },
    });
    if (!user) return res.status(404).json({ error: "User not found." });
    if (user.role !== "STUDENT") {
      return res.status(403).json({ error: "Student onboarding is only available for student accounts." });
    }
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ code: "EMAIL_VERIFICATION_REQUIRED", error: "Verify your email before onboarding." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        dateOfBirth: new Date(dateOfBirth),
        avatarUrl: avatarUrl || null,
        preparationTrack,
        preparationOther: preparationTrack === "OTHER" ? preparationOther : null,
        onboardingCompletedAt: user.onboardingCompletedAt || now,
      },
      include: { digitalId: true },
    });

    const digitalId = await issueDigitalIdForUser(updated.id, updated.role);
    const finalUser = { ...updated, digitalId };
    setAuthCookie(res, finalUser);

    return res.json({
      message: "Onboarding complete. Your Digital ID is ready.",
      user: toSafeUser(finalUser),
      digitalId,
    });
  } catch (err) {
    logger.error("completeOnboarding error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to complete onboarding." });
  }
}

async function verifyEmail(req, res) {
  try {
    const { verificationToken, code } = req.body;
    const tokenPayload = readVerificationToken(verificationToken, OTP_PURPOSES.VERIFY_ACCOUNT);
    if (!tokenPayload) {
      return res.status(400).json({ error: "Verification session expired. Please request a new code." });
    }

    const user = await prisma.user.findUnique({ where: { id: tokenPayload.userId } });
    if (!user || user.email !== tokenPayload.email) {
      return res.status(400).json({ error: "Verification session expired. Please request a new code." });
    }

    if (user.emailVerifiedAt) {
      setAuthCookie(res, user);
      return res.json({ message: "Email already verified.", user: toSafeUser(user) });
    }

    const challenge = await verifyOtpChallenge({
      user,
      channel: "EMAIL",
      target: user.email,
      code,
      purpose: OTP_PURPOSES.VERIFY_ACCOUNT,
    });

    const now = new Date();
    const [updated] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } }),
      prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } }),
    ]);

    setAuthCookie(res, updated);
    return res.json({ message: "Email verified.", user: toSafeUser(updated) });
  } catch (err) {
    logger.error("verifyEmail error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to verify email." });
  }
}

async function resendEmailVerification(req, res) {
  try {
    const { verificationToken } = req.body;
    const tokenPayload = readVerificationToken(verificationToken, OTP_PURPOSES.VERIFY_ACCOUNT);
    if (!tokenPayload) {
      return res.status(400).json({ error: "Verification session expired. Please log in again." });
    }

    const user = await prisma.user.findUnique({ where: { id: tokenPayload.userId } });
    if (!user || user.email !== tokenPayload.email) {
      return res.status(400).json({ error: "Verification session expired. Please log in again." });
    }

    if (user.emailVerifiedAt) {
      return res.json({ message: "Email already verified.", verificationToken });
    }

    const verification = await sendAccountVerification(user);
    return res.status(201).json({
      message: "OTP sent to email.",
      verificationToken: verification.verificationToken,
      devCode: verification.devCode,
    });
  } catch (err) {
    logger.error("resendEmailVerification error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to send OTP." });
  }
}

async function requestPasswordReset(req, res) {
  const genericMessage = "If this email exists, a reset OTP has been sent.";
  try {
    const email = normalizeEmail(req.body.email);
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      await createOtpChallenge({
        user,
        channel: "EMAIL",
        target: user.email,
        purpose: OTP_PURPOSES.RESET_PASSWORD,
        recipientName: user.name,
      });
    }

    return res.json({ message: genericMessage });
  } catch (err) {
    logger.error("requestPasswordReset error:", err);
    if (err.status === 503) return res.status(503).json({ error: err.message });
    return res.json({ message: genericMessage });
  }
}

async function resetPassword(req, res) {
  try {
    const { code, password } = req.body;
    const email = normalizeEmail(req.body.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    const challenge = await verifyOtpChallenge({
      user,
      channel: "EMAIL",
      target: user.email,
      code,
      purpose: OTP_PURPOSES.RESET_PASSWORD,
    });

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } }),
    ]);

    return res.json({ message: "Password reset successfully. You can log in now." });
  } catch (err) {
    logger.error("resetPassword error:", err);
    return res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to reset password." });
  }
}

async function logout(req, res) {
  res.clearCookie("token", COOKIE_OPTIONS);
  return res.json({ message: "Logged out successfully." });
}

async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { digitalId: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    logger.error("Me error:", err);
    return res.status(500).json({ error: "Something went wrong." });
  }
}

async function requestOtp(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: "User not found." });

    const { channel, target } = req.body;
    const normalizedTarget = normalizeOtpTarget(user, channel, target);
    if (!normalizedTarget) {
      return res.status(400).json({ error: channel === "EMAIL" ? "Email is required." : "Mobile number is required." });
    }

    if (channel === "EMAIL" && normalizedTarget !== normalizeEmail(user.email)) {
      return res.status(400).json({ error: "Digital ID email verification must use your account email." });
    }

    const result = await createOtpChallenge({
      user,
      channel,
      target: normalizedTarget,
      purpose: OTP_PURPOSES.DIGITAL_ID,
      recipientName: user.name,
    });

    return res.status(201).json({
      message: `OTP sent to ${channel === "EMAIL" ? "email" : "mobile"}.`,
      challengeId: result.challenge.id,
      devCode: result.devCode,
      target: maskTarget(channel, normalizedTarget),
    });
  } catch (err) {
    logger.error("requestOtp error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to send OTP." });
  }
}

async function verifyOtp(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: "User not found." });

    const { channel, code, target } = req.body;
    const normalizedTarget = normalizeOtpTarget(user, channel, target);
    if (channel === "EMAIL" && normalizedTarget !== normalizeEmail(user.email)) {
      return res.status(400).json({ error: "Digital ID email verification must use your account email." });
    }

    const challenge = await verifyOtpChallenge({
      user,
      channel,
      target: normalizedTarget,
      code,
      purpose: OTP_PURPOSES.DIGITAL_ID,
    });

    const now = new Date();
    const updateData =
      channel === "EMAIL"
        ? { emailVerifiedAt: user.emailVerifiedAt || now }
        : { mobileNumber: normalizedTarget, mobileVerifiedAt: now };

    const [updated] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: updateData }),
      prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } }),
    ]);

    return res.json({ message: "OTP verified.", user: toSafeUser(updated) });
  } catch (err) {
    logger.error("verifyOtp error:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to verify OTP." });
  }
}

async function deleteAccount(req, res) {
  try {
    const userId = req.user.userId;
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found." });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid password." });
    }

    await prisma.$transaction(async (tx) => {
      const userPaymentsWhere = {
        OR: [{ studentId: userId }, { course: { teacherId: userId } }],
      };

      await tx.studyRoomMessageReport.deleteMany({
        where: { OR: [{ reportedById: userId }, { resolvedById: userId }] },
      });
      await tx.paymentRefund.deleteMany({
        where: { OR: [{ requestedById: userId }, { payment: userPaymentsWhere }] },
      });
      await tx.invoice.deleteMany({ where: { payment: userPaymentsWhere } });
      await tx.payment.deleteMany({ where: userPaymentsWhere });

      await tx.enrollment.deleteMany({
        where: { OR: [{ studentId: userId }, { course: { teacherId: userId } }] },
      });
      await tx.courseVideo.deleteMany({ where: { course: { teacherId: userId } } });
      await tx.course.deleteMany({ where: { teacherId: userId } });

      await tx.subscriptionPayment.deleteMany({ where: { userId } });
      await tx.subscription.deleteMany({ where: { userId } });
      await tx.studentParentLink.deleteMany({
        where: { OR: [{ studentId: userId }, { parentId: userId }] },
      });
      await tx.roomMember.deleteMany({ where: { userId } });
      await tx.room.updateMany({ where: { createdById: userId }, data: { createdById: null } });

      await tx.task.deleteMany({ where: { userId } });
      await tx.roadmapItem.deleteMany({ where: { userId } });
      await tx.focusSession.deleteMany({ where: { userId } });
      await tx.userBadge.deleteMany({ where: { userId } });
      await tx.dailyChallenge.deleteMany({ where: { userId } });
      await tx.certificateExamBank.deleteMany({ where: { userId } });
      await tx.certificate.deleteMany({ where: { userId } });
      await tx.examAttempt.deleteMany({ where: { userId } });
      await tx.penaltyEvent.deleteMany({ where: { userId } });
      await tx.activityLog.deleteMany({ where: { userId } });
      await tx.studyRoomMessage.deleteMany({ where: { userId } });
      await tx.aiMentorMessage.deleteMany({ where: { userId } });
      await tx.savedVideo.deleteMany({ where: { userId } });
      await tx.quizAttempt.deleteMany({ where: { userId } });
      await tx.otpChallenge.deleteMany({ where: { userId } });
      await tx.teacherVerification.deleteMany({ where: { teacherId: userId } });
      await tx.digitalId.deleteMany({ where: { userId } });

      await tx.user.delete({ where: { id: userId } });
    });

    res.clearCookie("token", COOKIE_OPTIONS);
    return res.json({ message: "Account and personal data deleted." });
  } catch (err) {
    logger.error("deleteAccount error:", err);
    return res.status(500).json({ error: "Failed to delete account." });
  }
}

module.exports = {
  signup,
  login,
  completeOnboarding,
  verifyEmail,
  resendEmailVerification,
  requestPasswordReset,
  resetPassword,
  logout,
  me,
  requestOtp,
  verifyOtp,
  deleteAccount,
};
