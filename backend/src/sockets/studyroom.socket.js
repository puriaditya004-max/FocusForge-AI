// ===========================================================
// sockets/studyroom.socket.js — Real-time Study Room chat
// ===========================================================
// Same JWT (httpOnly "token" cookie) used by REST routes is
// reused here for socket auth, so a student only ever logs in
// once — no separate socket login step.
//
// Online-user tracking is in-memory (a Map), NOT in the DB —
// "who's online right now" is transient and doesn't need to
// survive a server restart. Chat messages themselves ARE saved
// to StudyRoomMessage so history persists.
//
// Events (client -> server):
//   join_room   { roomId }
//   send_message { roomId, message }
//   leave_room  { roomId }
//
// Events (server -> client):
//   online_users  [{ userId, name }]   -- broadcast to a room
//   new_message   { id, userId, userName, message, time }
//   error_message { error }
// ===========================================================

const jwt = require("jsonwebtoken");
const prisma = require("../config/db");

// Simple manual cookie parser — avoids relying on the `cookie` package's
// export shape, which varies between versions (some are ESM-only in CJS).
function parseCookies(rawCookieHeader) {
  const result = {};
  if (!rawCookieHeader) return result;
  rawCookieHeader.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = decodeURIComponent(pair.slice(idx + 1).trim());
    result[key] = value;
  });
  return result;
}

// roomId -> Map(userId -> { userId, name, socketId })
const roomOnlineUsers = new Map();

function getOnlineList(roomId) {
  const map = roomOnlineUsers.get(roomId);
  if (!map) return [];
  return Array.from(map.values()).map((u) => ({ userId: u.userId, name: u.name }));
}

function removeFromOnline(roomId, userId) {
  const map = roomOnlineUsers.get(roomId);
  if (map) map.delete(userId);
}

module.exports = function studyRoomSocket(io) {
  // ---- Auth middleware: same JWT cookie as REST APIs ----
  io.use((socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;

      if (!rawCookie) return next(new Error("Not authenticated"));

      const parsed = parseCookies(rawCookie);
      const token = parsed.token;

      if (!token) return next(new Error("Not authenticated"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId; // known gotcha: userId, not id
      next();
    } catch (err) {
      console.error("Socket auth failed:", err.message);
      next(new Error("Invalid or expired session"));
    }
  });

  io.on("connection", (socket) => {
    let currentRoomId = null;

    // ---- Join a room ----
    socket.on("join_room", async ({ roomId }) => {
      try {
        if (!roomId) return;

        const user = await prisma.user.findUnique({ where: { id: socket.userId } });
        if (!user) return;

        // Leave previous room first (a student is only ever "in" one room at a time)
        if (currentRoomId && currentRoomId !== roomId) {
          socket.leave(currentRoomId);
          removeFromOnline(currentRoomId, socket.userId);
          io.to(currentRoomId).emit("online_users", getOnlineList(currentRoomId));
        }

        socket.join(roomId);
        currentRoomId = roomId;

        if (!roomOnlineUsers.has(roomId)) roomOnlineUsers.set(roomId, new Map());
        roomOnlineUsers.get(roomId).set(socket.userId, {
          userId: socket.userId,
          name: user.name,
          socketId: socket.id,
        });

        io.to(roomId).emit("online_users", getOnlineList(roomId));
      } catch (err) {
        console.error("join_room error:", err);
        socket.emit("error_message", { error: "Could not join room" });
      }
    });

    // ---- Send a message ----
    socket.on("send_message", async ({ roomId, message }) => {
      try {
        if (!roomId || !message || !message.trim()) return;

        const user = await prisma.user.findUnique({ where: { id: socket.userId } });
        if (!user) return;

        const saved = await prisma.studyRoomMessage.create({
          data: { userId: socket.userId, roomId, message: message.trim() },
        });

        io.to(roomId).emit("new_message", {
          id: saved.id,
          userId: socket.userId,
          userName: user.name,
          message: saved.message,
          time: saved.createdAt,
        });
      } catch (err) {
        console.error("send_message error:", err);
        socket.emit("error_message", { error: "Message could not be sent" });
      }
    });

    // ---- Leave a room explicitly (e.g. student navigates away) ----
    socket.on("leave_room", ({ roomId }) => {
      if (!roomId) return;
      socket.leave(roomId);
      removeFromOnline(roomId, socket.userId);
      io.to(roomId).emit("online_users", getOnlineList(roomId));
      if (currentRoomId === roomId) currentRoomId = null;
    });

    // ---- Disconnect (tab closed, refresh, connection drop) ----
    socket.on("disconnect", () => {
      if (currentRoomId) {
        removeFromOnline(currentRoomId, socket.userId);
        io.to(currentRoomId).emit("online_users", getOnlineList(currentRoomId));
      }
    });
  });
};