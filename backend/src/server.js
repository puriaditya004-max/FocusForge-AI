// ---------------------------------------------------------
// server.js — actual entry point. Boots the HTTP server.
// Socket.io (for Study Room live chat) is attached to this
// same `httpServer` — no restructuring needed, as planned.
// ---------------------------------------------------------
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const studyRoomSocket = require("./sockets/studyroom.socket");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

// Same allowed-origins list as app.js — Study Room sockets need
// to accept connections from the Android/iOS app too.
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "https://localhost",
  "capacitor://localhost",
].filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

studyRoomSocket(io);

httpServer.listen(PORT, () => {
  logger.info(`✅ FocusForge AI backend running on http://localhost:${PORT}`);
});