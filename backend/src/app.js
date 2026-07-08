// ---------------------------------------------------------
// app.js — Express app configuration (no server.listen here,
// that lives in server.js so Socket.io can share the same
// HTTP server later without restructuring this file).
//
// SECURITY LAYERS (in order they run on every request):
//   1. helmet          → sets safe HTTP security headers
//   2. cors            → only our real frontend origin allowed
//   3. express.json    → body parsing (size-limited)
//   4. cookieParser     → reads httpOnly auth cookie
//   5. hpp             → blocks HTTP param pollution (?role=STUDENT&role=TEACHER tricks)
//   6. sanitizeInputs   → strips HTML/script from all text input (XSS protection)
//   7. apiLimiter       → blocks scripted abuse / scraping
// ---------------------------------------------------------
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const hpp = require("hpp");

const routes = require("./routes");
const sanitizeInputs = require("./middleware/sanitize.middleware");
const { apiLimiter } = require("./middleware/rateLimiter.middleware");

const app = express();

// --- Security headers (CSP, no-sniff, frameguard, etc.) ---
app.use(helmet());
// Remove the "X-Powered-By: Express" header so attackers can't
// easily fingerprint the framework/version we're running.
app.disable("x-powered-by");

// --- Core middleware ---
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true, // allow cookies to be sent from the frontend
  })
);
app.use(express.json({ limit: "10mb" })); // images/PDFs come in as base64, need a higher limit
app.use(cookieParser());

// --- Blocks HTTP Parameter Pollution (e.g. duplicate query/body keys used to bypass checks) ---
app.use(hpp());

// --- Strips any HTML/script tags out of all incoming text (XSS protection) ---
app.use(sanitizeInputs);

// --- General rate limiting for all /api routes (auth routes have their own stricter limiter) ---
app.use("/api", apiLimiter);

// --- Health check (useful for Railway/Render deployment checks) ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// --- Feature routes ---
app.use("/api", routes);

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// --- Global error handler (catches anything thrown/next(err)) ---
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Something went wrong on the server.",
  });
});

module.exports = app;