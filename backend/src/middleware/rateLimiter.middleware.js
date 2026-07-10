// ---------------------------------------------------------
// middleware/rateLimiter.middleware.js
// Three limiter groups:
//   - authLimiter  → very strict, on /auth/login and /auth/signup
//                    (blocks brute-force password guessing & spam signups)
//   - apiLimiter   → looser, applied to all other /api routes
//                    (blocks generic scraping/abuse)
//   - aiBurstLimiter / aiDailyLimiter → applied only to AI Mentor
//                    routes that call the shared Gemini key (message,
//                    voice-command, generate-quiz). These are keyed
//                    per-USER (not per-IP) so one student can't eat
//                    the whole app's free-tier quota and lock everyone
//                    else out of the mentor for the day. Students who
//                    bring their own Claude key (BYOK) still count
//                    against this — they're rate-limited the same way
//                    for consistency and to stop runaway loops, but in
//                    practice they'll rarely hit it since their calls
//                    don't touch the shared Gemini quota at all.
//
// Both are keyed by IP by default. Because students, parents,
// and teachers may be on shared school/home wifi (same IP),
// authLimiter also factors in the submitted email so one
// slow typist on a school network doesn't lock out everyone
// else on that IP.
//
// Tune AI_DAILY_MAX once you have real usage data from Google AI
// Studio — start conservative and raise it if the free Gemini
// quota (see mentor.controller.js) has headroom to spare.
// ---------------------------------------------------------
const rateLimit = require("express-rate-limit");

const AI_DAILY_MAX = 40; // combined cap across message/voice-command/generate-quiz, per user, per day
const AI_BURST_MAX = 6; // stops a script from firing the whole daily cap in one minute

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // 8 attempts per window per key
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = (req.body?.email || "").toLowerCase().trim();
    return `${req.ip}:${email}`;
  },
  handler: (req, res) => {
    return res.status(429).json({
      error: "Too many attempts. Please wait 15 minutes before trying again.",
    });
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // generous, just stops scripted abuse
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      error: "Too many requests. Please slow down and try again shortly.",
    });
  },
});

// Must run AFTER requireAuth on the route (needs req.user.userId).
// Falls back to IP if somehow unauthenticated, so it never throws.
const aiKeyGenerator = (req) => (req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`);

const aiDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: AI_DAILY_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: aiKeyGenerator,
  handler: (req, res) => {
    return res.status(429).json({
      error:
        "You've reached today's AI Mentor limit. It resets in a few hours — or add your own Claude API key in Settings for unlimited use.",
    });
  },
});

const aiBurstLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: AI_BURST_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: aiKeyGenerator,
  handler: (req, res) => {
    return res.status(429).json({
      error: "You're sending messages too fast. Wait a few seconds and try again.",
    });
  },
});

module.exports = { authLimiter, apiLimiter, aiDailyLimiter, aiBurstLimiter };