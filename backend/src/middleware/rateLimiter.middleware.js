// ---------------------------------------------------------
// middleware/rateLimiter.middleware.js
// Two limiters:
//   - authLimiter  → very strict, on /auth/login and /auth/signup
//                    (blocks brute-force password guessing & spam signups)
//   - apiLimiter   → looser, applied to all other /api routes
//                    (blocks generic scraping/abuse)
//
// Both are keyed by IP by default. Because students, parents,
// and teachers may be on shared school/home wifi (same IP),
// authLimiter also factors in the submitted email so one
// slow typist on a school network doesn't lock out everyone
// else on that IP.
// ---------------------------------------------------------
const rateLimit = require("express-rate-limit");

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

module.exports = { authLimiter, apiLimiter };