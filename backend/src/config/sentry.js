// ---------------------------------------------------------
// config/sentry.js — error tracking (Sentry).
//
// Right now, every error only goes to winston (console + a log
// file in production) — and that log file lives on Render's
// ephemeral disk, so it's gone on the next redeploy/restart. With
// no alerting, a production bug can sit unnoticed until a user
// complains. Sentry gives a permanent, searchable error history
// plus (optional) email/Slack alerts, completely separate from
// Render's disk.
//
// Free tier (5,000 errors/month) is far more than a solo-founder
// launch needs.
//
// No dependency on ../utils/logger here on purpose — logger.js
// requires this file to hook Sentry into logger.error(), so this
// file must not require logger back (that would be circular).
// Plain console.* is used for this module's own status message.
// ---------------------------------------------------------
let Sentry = null;

if (process.env.SENTRY_DSN) {
  Sentry = require("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    // Keep this low — full request tracing isn't needed for a
    // solo-founder launch and eats into the free quota faster
    // than error capture alone does.
    tracesSampleRate: 0.1,
  });
  console.log("✅ Sentry error tracking initialized");
} else {
  console.warn(
    "⚠️  SENTRY_DSN not set — errors are only in local logs (winston), not tracked or alertable anywhere. " +
      "Get a free DSN at sentry.io and set SENTRY_DSN before relying on this in production."
  );
}

module.exports = Sentry;
