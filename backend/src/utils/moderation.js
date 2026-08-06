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
//      In-memory (like the online-users map in the socket file)
//      because it's transient and doesn't need to survive a
//      server restart.
// ---------------------------------------------------------

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
const sendLog = new Map();
const WINDOW_MS = 10_000; // 10 seconds
const MAX_MESSAGES_PER_WINDOW = 8;

function isRateLimited(roomId, userId) {
  const key = `${roomId}:${userId}`;
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

module.exports = { containsBannedWord, isRateLimited, MAX_MESSAGES_PER_WINDOW };
