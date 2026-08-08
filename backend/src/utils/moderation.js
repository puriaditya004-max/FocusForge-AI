// ---------------------------------------------------------
// moderation.js — Study Room chat moderation helpers.
//
// Two independent checks, both run server-side before a
// message is saved/broadcast (client-side checks can always
// be bypassed, so this is the real enforcement point):
//
//   1. containsBannedWord(text) — blocks a fixed list of slurs/
//      profanity. Deliberately a blunt, small, easy-to-extend
//      list rather than a "smart" classifier — false negatives
//      are safer to accept here than false positives blocking
//      normal study chat.
//
//   2. RateLimiter — caps how many messages one user can send
//      per room in a rolling window, to stop spam/flooding.
//      Uses Redis (shared counter, TTL = window) when REDIS_URL
//      is set, so the limit holds even across multiple backend
//      instances. Falls back to the original in-memory Map when
//      Redis isn't configured — same behavior as before, just
//      single-instance only.
// ---------------------------------------------------------
const redisClient = require("../config/redis");

// Intentionally short and blunt — extend as needed. Kept lowercase;
// matching is case-insensitive and ignores basic leetspeak substitutions.
const BANNED_WORDS = [
  "fuck", "fck", "shit", "bitch", "bastard", "asshole", "cunt",
  "randi", "chutiya", "madarchod", "behenchod", "bhosdike", "gandu",
  "rape", "kill yourself", "kys",
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[$5]/g, "s")
    .replace(/1/g, "i")
    .replace(/0/g, "o")
    .replace(/3/g, "e")
    .replace(/[^a-z\s]/g, ""); // strip punctuation/numbers used to dodge the filter
}

function containsBannedWord(text) {
  const normalized = normalize(text);
  return BANNED_WORDS.some((word) => normalized.includes(word));
}

// roomId:userId -> array of send timestamps (ms) within the window
// (only used as the fallback when REDIS_URL isn't set)
const sendLog = new Map();
const WINDOW_MS = 10_000; // 10 seconds
const MAX_MESSAGES_PER_WINDOW = 8;

async function isRateLimitedRedis(key) {
  // INCR + first-hit EXPIRE gives us a simple fixed-window counter:
  // each key counts messages in the current 10s window and expires
  // on its own, so there's nothing to clean up.
  const count = await redisClient.incr(key);
  if (count === 1) {
    await redisClient.pexpire(key, WINDOW_MS);
  }
  return count > MAX_MESSAGES_PER_WINDOW;
}

function isRateLimitedMemory(key) {
  const now = Date.now();
  const timestamps = (sendLog.get(key) || []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_MESSAGES_PER_WINDOW) {
    sendLog.set(key, timestamps); // keep pruned list even when limited
    return true;
  }

  timestamps.push(now);
  sendLog.set(key, timestamps);
  return false;
}

async function isRateLimited(roomId, userId) {
  const key = `chatrl:${roomId}:${userId}`;
  if (redisClient) {
    try {
      return await isRateLimitedRedis(key);
    } catch (err) {
      // Redis hiccup shouldn't block chat entirely — fall back to
      // the in-memory check for this call instead of throwing.
      return isRateLimitedMemory(key);
    }
  }
  return isRateLimitedMemory(key);
}

module.exports = { containsBannedWord, isRateLimited, MAX_MESSAGES_PER_WINDOW };
