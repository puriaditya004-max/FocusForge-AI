// ---------------------------------------------------------
// utils/aiUsage.js — tracks how many Gemini calls the app makes
// per day, and warns (loudly, via Sentry) when that approaches a
// configurable daily budget.
//
// Why this matters: every student's AI Mentor chat — unless they've
// added their own Claude key in Settings — runs on ONE shared
// GEMINI_API_KEY that the founder pays for (or gets rate-limited
// on, on the free tier). There was previously no visibility into
// how close that shared quota is to being exhausted; the first
// sign of a problem would be students suddenly getting mentor
// errors with no warning beforehand.
//
// Published Gemini free-tier daily-request numbers change often and
// disagree across sources — check the actual current quota for your
// project in the Google AI Studio console (ai.google.dev) rather
// than trusting any fixed number here. GEMINI_DAILY_ALERT_THRESHOLD
// in .env is intentionally configurable so it can be tuned to
// whatever your real quota turns out to be.
//
// Uses the same Redis client (and same graceful in-memory fallback)
// as config/redis.js from the rate-limiting work — no new
// infrastructure needed. Counts reset naturally every day since the
// counter key is date-scoped and Redis keys here carry a 25h TTL.
// ---------------------------------------------------------
const redisClient = require("../config/redis");
const logger = require("../utils/logger");

const DEFAULT_THRESHOLD = 400; // conservative default; tune via env once you know your real quota
const ALERT_THRESHOLD = Number(process.env.GEMINI_DAILY_ALERT_THRESHOLD) || DEFAULT_THRESHOLD;
const DAY_TTL_SECONDS = 25 * 60 * 60; // slightly over 24h so a slow day boundary never drops a count early

// In-memory fallback, same spirit as moderation.js's fallback —
// only used when REDIS_URL isn't set (single instance only, resets
// on restart, but still better than no visibility at all locally).
const memoryCounts = new Map();
const alertedToday = new Set(); // dateKey -> already alerted, avoid spamming Sentry every single call once past threshold

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

async function incrementMemory(key) {
  const count = (memoryCounts.get(key) || 0) + 1;
  memoryCounts.set(key, count);
  return count;
}

async function incrementRedis(key) {
  const count = await redisClient.incr(key);
  if (count === 1) {
    await redisClient.expire(key, DAY_TTL_SECONDS);
  }
  return count;
}

/**
 * Call this once per actual Gemini API request (successful or not —
 * a request that gets rate-limited or errors still counts against
 * RPD on Google's side). Fires a Sentry-visible warning the first
 * time today's count crosses ALERT_THRESHOLD; stays silent on every
 * call after that same threshold-crossing, so it alerts once per
 * day, not once per remaining request.
 */
async function recordGeminiCall() {
  const dateKey = todayKey();
  const redisKey = `airusage:gemini:${dateKey}`;

  let count;
  try {
    count = redisClient ? await incrementRedis(redisKey) : await incrementMemory(redisKey);
  } catch (err) {
    // Never let usage tracking itself break the actual AI Mentor call.
    logger.warn("aiUsage: failed to record Gemini call count:", err.message);
    return;
  }

  if (count >= ALERT_THRESHOLD && !alertedToday.has(dateKey)) {
    alertedToday.add(dateKey);
    // logger.error (not .warn) deliberately — this is the hook that
    // forwards to Sentry (see utils/logger.js), and a budget alert
    // is exactly the kind of thing that should surface somewhere
    // the founder actually sees, not just scroll past in console
    // output.
    logger.error(
      `Gemini daily usage threshold crossed: ${count} calls today (threshold: ${ALERT_THRESHOLD}). ` +
        "Check your real quota in the Google AI Studio console — the shared AI Mentor key may be close to " +
        "its daily limit, which would start failing for every student, not just heavy users."
    );
  }
}

module.exports = { recordGeminiCall };
