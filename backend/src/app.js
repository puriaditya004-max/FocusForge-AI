// ---------------------------------------------------------
// app.js — Express app configuration (no server.listen here,
// that lives in server.js so Socket.io can share the same
// HTTP server later without restructuring this file).
// ---------------------------------------------------------
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const routes = require("./routes");

const app = express();

// --- Core middleware ---
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true, // allow cookies to be sent from the frontend
  })
);
app.use(express.json({ limit: "10mb" })); // images/PDFs come in as base64, need a higher limit
app.use(cookieParser());

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