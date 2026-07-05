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

// --- Allowed origins ---
// Requests now come from 4 different places:
//  1. The deployed Vercel frontend (CLIENT_URL env var)
//  2. Local dev (npm run dev on your laptop)
//  3. The Capacitor Android app — serves its content from the
//     fixed origin "https://localhost" (set by androidScheme:
//     "https" in capacitor.config.ts)
//  4. A Capacitor iOS app, if/when built — uses "capacitor://localhost"
const allowedOrigins = [
  process.env.CLIENT_URL,        // e.g. https://focus-forge-ai-woad.vercel.app
  "http://localhost:5173",       // local frontend dev server
  "https://localhost",           // Capacitor Android app
  "capacitor://localhost",       // Capacitor iOS app
].filter(Boolean);

// --- Core middleware ---
app.use(
  cors({
    origin: function (origin, callback) {
      // requests with no origin (like Postman, curl, health checks) are allowed
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
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
