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
];

// Fields that are stored as UPPERCASE enums in Prisma but
// lowercase strings on the frontend
const ENUM_FIELDS = ["focusSensitivity", "theme"];

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
  theme: user.theme.toLowerCase(),
  accentColor: user.accentColor,
  mentorApiKey: user.mentorApiKey || null,
});

// GET /api/settings
const getSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(formatUser(user));
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
        data[key] = ENUM_FIELDS.includes(key)
          ? String(body[key]).toUpperCase()
          : body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const updated = await prisma.user.update({ where: { id: userId }, data });
    res.status(200).json(formatUser(updated));
  } catch (err) {
    logger.error("updateSettings error:", err);
    res.status(500).json({ message: "Failed to update settings" });
  }
};

module.exports = {
  getSettings,
  updateSettings,
};