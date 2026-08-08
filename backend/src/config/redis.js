// ---------------------------------------------------------
// config/redis.js — single shared ioredis client.
//
// If REDIS_URL is not set (e.g. local dev, or before this is
// provisioned in production), this exports `null` instead of
// throwing. Every caller (rateLimiter.middleware.js,
// moderation.js, server.js socket adapter) checks for that and
// falls back to the previous in-memory behavior — so nothing
// breaks for anyone who hasn't set up Redis yet. Once REDIS_URL
// is set (e.g. Upstash / Render Key Value / Redis Cloud), rate
// limits and Socket.IO broadcasts start working correctly across
// multiple server instances automatically, with no other code
// changes needed.
// ---------------------------------------------------------
const logger = require("../utils/logger");

let redisClient = null;

if (process.env.REDIS_URL) {
  const Redis = require("ioredis");

  redisClient = new Redis(process.env.REDIS_URL, {
    // ioredis default retry strategy retries forever with backoff,
    // which is what we want for a managed Redis (brief network blips
    // shouldn't take rate-limiting down) — just cap the delay.
    retryStrategy: (times) => Math.min(times * 200, 5000),
    maxRetriesPerRequest: 3,
  });

  redisClient.on("connect", () => {
    logger.info("✅ Redis connected (rate-limit store + Socket.IO adapter)");
  });

  redisClient.on("error", (err) => {
    // Log and keep going — ioredis will keep retrying in the
    // background; we don't want a transient Redis issue to crash
    // the whole API.
    logger.error("Redis client error:", err.message);
  });
} else {
  logger.warn(
    "⚠️  REDIS_URL not set — rate limits and Socket.IO are running in-memory (single-instance only). " +
      "Fine for local dev or a single Render instance; set REDIS_URL before scaling to 2+ instances."
  );
}

module.exports = redisClient;
