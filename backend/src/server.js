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
const redisClient = require("./config/redis");
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

// Without this, if Render ever runs more than one instance of this
// backend, a "join_room"/"send_message" handled by instance A never
// reaches a student whose socket landed on instance B — Study Room
// chat and online-user lists would silently go out of sync. The
// Redis adapter makes Socket.IO broadcast events through Redis
// instead, so every instance sees every event regardless of which
// one a given client is connected to. On a single instance (or with
// no REDIS_URL set) this is a no-op and behavior is unchanged.
async function attachRedisAdapter() {
  if (!redisClient) return;
  try {
    const { createAdapter } = require("@socket.io/redis-adapter");
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("✅ Socket.IO Redis adapter attached (multi-instance safe)");
  } catch (err) {
    logger.error("Socket.IO Redis adapter failed to attach — running single-instance only:", err.message);
  }
}
attachRedisAdapter();

studyRoomSocket(io);

httpServer.listen(PORT, () => {
  logger.info(`✅ FocusForge AI backend running on http://localhost:${PORT}`);
});
