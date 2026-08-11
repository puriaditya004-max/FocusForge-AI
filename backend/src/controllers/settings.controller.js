// ---------------------------------------------------------
// settings.controller.js — Profile, Timetable, Preferences,
// Notifications, Appearance settings. All fields live on the
// User model, so this is a single GET + single PATCH.
//
// mentorApiKey (AI Mentor BYOK) is included here too — same
// User model, same GET/PATCH pattern. Sending `null` clears it
// (falls back to the free shared Gemini tier).
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");
const { encrypt, decrypt, mask } = require("../utils/crypto");

const ALLOWED_FIELDS = [
  "name",
  "avatarUrl",
  "studyStartTime",
  "studyEndTime",
  "offDays",
  "dailyGoalHours",
  "breakIntervalMin",
  "focusSensitivity",
  "dailyReminderOn",
  "reminderTime",
  "streakAlertOn",
  "weeklySummaryOn",
  "theme",
  "accentColor",
  "mentorApiKey",
  "mobileNumber",
  "razorpayRouteAccountId",
];

// Fields that are stored as UPPERCASE enums in Prisma but
// lowercase strings on the frontend
const ENUM_FIELDS = ["focusSensitivity", "theme"];

function themeToFrontend(theme) {
  const value = String(theme || "DARK").toLowerCase();
  return value === "light" ? "bright" : value;
}

function themeToPrisma(theme) {
  const value = String(theme || "").toLowerCase();
  if (value === "bright") return "LIGHT";
  if (value === "purple") return "PURPLE";
  return "DARK";
}

const formatUser = (user) => ({
  name: user.name,
  avatarUrl: user.avatarUrl,
  level: user.level,
  xp: user.xp,
  currentStreak: user.currentStreak,
  longestStreak: user.longestStreak,
  joinedDate: user.createdAt.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  }),
  studyStartTime: user.studyStartTime,
  studyEndTime: user.studyEndTime,
  offDays: user.offDays,
  dailyGoalHours: user.dailyGoalHours,
  breakIntervalMin: user.breakIntervalMin,
  focusSensitivity: user.focusSensitivity.toLowerCase(),
  dailyReminderOn: user.dailyReminderOn,
  reminderTime: user.reminderTime,
  streakAlertOn: user.streakAlertOn,
  weeklySummaryOn: user.weeklySummaryOn,
  theme: themeToFrontend(user.theme),
  accentColor: user.accentColor,
  // Never send the full key back — mask() shows just enough
  // (prefix + last 4 chars) for the student to recognize which
  // key is saved, without exposing it to anyone reading the response.
  mentorApiKey: user.mentorApiKey ? mask(decrypt(user.mentorApiKey)) : null,
  hasMentorApiKey: !!user.mentorApiKey,
  mobileNumber: user.mobileNumber,
  emailVerifiedAt: user.emailVerifiedAt,
  mobileVerifiedAt: user.mobileVerifiedAt,
  teacherVerificationStatus: user.teacherVerificationStatus,
  razorpayRouteAccountId: user.razorpayRouteAccountId,
});

function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function buildSettingsResponse(user) {
  const [certificates, enrollments, activityLogs] = await Promise.all([
    prisma.certificate.findMany({
      where: { userId: user.id },
      orderBy: { issuedAt: "desc" },
      take: 5,
    }),
    prisma.enrollment.findMany({
      where: { studentId: user.id },
      include: { course: { include: { teacher: { select: { name: true } } } } },
      orderBy: { enrolledAt: "desc" },
      take: 5,
    }),
    prisma.activityLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const formattedCertificates = certificates.map((cert) => ({
    id: cert.certificateCode,
    title: cert.title,
    score: cert.score,
    date: formatDate(cert.issuedAt),
  }));

  const formattedCourses = enrollments.map((enrollment) => ({
    id: enrollment.id,
    name: enrollment.course.title,
    teacherName: enrollment.course.teacher.name,
    progress: enrollment.progress,
    status: enrollment.status,
    enrolledAt: formatDate(enrollment.enrolledAt),
  }));

  const journeyMilestones = [
    {
      label: "Joined FocusForge AI",
      date: formatDate(user.createdAt),
      done: true,
    },
    ...(user.currentStreak > 0
      ? [{
          label: `Built a ${user.currentStreak}-day study streak`,
          date: "Current",
          done: true,
        }]
      : []),
    ...formattedCertificates.slice(0, 1).map((cert) => ({
      label: `Earned certificate: ${cert.title}`,
      date: cert.date,
      done: true,
    })),
    ...formattedCourses.slice(0, 1).map((course) => ({
      label: `Enrolled in ${course.name}`,
      date: course.enrolledAt,
      done: true,
    })),
    ...activityLogs.map((log) => ({
      label: log.text,
      date: formatDate(log.createdAt),
      done: true,
    })),
  ];

  return {
    ...formatUser(user),
    certificatesEarned: formattedCertificates,
    coursesInProgress: formattedCourses,
    journeyMilestones,
  };
}

// GET /api/settings
const getSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(await buildSettingsResponse(user));
  } catch (err) {
    logger.error("getSettings error:", err);
    res.status(500).json({ message: "Failed to fetch settings" });
  }
};

// PATCH /api/settings
// Accepts a partial body — only the fields that are sent get updated.
const updateSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const body = req.body;

    const data = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) {
        if (key === "mentorApiKey") {
          // Empty string / null clears the saved key (falls back to
          // shared Gemini tier); anything else gets encrypted at rest.
          data[key] = body[key] ? encrypt(body[key]) : null;
        } else if (key === "theme") {
          data[key] = themeToPrisma(body[key]);
        } else {
          data[key] = ENUM_FIELDS.includes(key)
            ? String(body[key]).toUpperCase()
            : body[key];
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    if (data.dailyGoalHours !== undefined) {
      const strictestParentGoal = await prisma.studentParentLink.findFirst({
        where: {
          studentId: userId,
          status: "APPROVED",
          minDailyGoalHours: { not: null },
        },
        orderBy: { minDailyGoalHours: "desc" },
        select: { minDailyGoalHours: true },
      });
      const minGoal = strictestParentGoal?.minDailyGoalHours || 0;
      const requestedGoal = Number(data.dailyGoalHours);
      if (!Number.isFinite(requestedGoal)) {
        return res.status(400).json({ message: "Daily goal must be a number" });
      }
      data.dailyGoalHours = Math.max(Math.round(requestedGoal), minGoal);
    }

    const updated = await prisma.user.update({ where: { id: userId }, data });
    res.status(200).json(await buildSettingsResponse(updated));
  } catch (err) {
    logger.error("updateSettings error:", err);
    res.status(500).json({ message: "Failed to update settings" });
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
