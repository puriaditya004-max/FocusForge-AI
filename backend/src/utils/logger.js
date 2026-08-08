// ---------------------------------------------------------
// utils/logger.js — centralized structured logging (winston).
//
// Why this exists instead of console.log everywhere:
//   - Levels (error/warn/info) mean you can filter noise later
//     (e.g. only show errors in production dashboards).
//   - Every log line gets a timestamp automatically.
//   - In production, logs also get written to files on disk
//     (logs/error.log, logs/combined.log) so you can look back
//     at what happened even if the terminal/Render console
//     history has scrolled away.
//   - Swapping to a hosted log service later (e.g. Logtail,
//     Datadog) is a one-line change here, not a find/replace
//     across 20 files.
//
// Usage anywhere in the backend:
//   const logger = require("../utils/logger");   // adjust ../ depth
//   logger.info("User logged in", { userId: user.id });
//   logger.warn("Blocked by CORS", { origin });
//   logger.error("Signup error:", err);
// ---------------------------------------------------------
const winston = require("winston");
const path = require("path");

const isProduction = process.env.NODE_ENV === "production";

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({ format: consoleFormat }),
];

// Only write to log files in production — keeps local dev folders clean,
// and Render/Vercel-style hosts already capture console output separately
// so this gives us a second, structured copy specifically for errors.
if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
      format: fileFormat,
    })
  );
}

const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  transports,
});

// --- Sentry hook (see comment at the top of this file) ---
// Every logger.error(...) call also forwards to Sentry when
// SENTRY_DSN is configured, so production errors are tracked and
// alertable somewhere that survives a Render restart — not just
// written to logs/error.log, which doesn't. No-ops entirely if
// Sentry isn't configured (config/sentry.js exports null).
const Sentry = require("../config/sentry");
if (Sentry) {
  const originalError = logger.error.bind(logger);
  logger.error = (message, ...meta) => {
    originalError(message, ...meta);
    const errorArg = [message, ...meta].find((item) => item instanceof Error);
    if (errorArg) {
      Sentry.captureException(errorArg);
    } else {
      Sentry.captureMessage(String(message), "error");
    }
    return logger;
  };
}

module.exports = logger;
