// ---------------------------------------------------------
// validators/studyroom.validator.js
// Zod schemas for Study Room REST routes.
//
// NOTE: actual chat messages are sent over Socket.io
// (sockets/studyroom.socket.js), NOT this REST route — that
// event ("send_message") is not covered by Express middleware,
// so it needs its own inline check. See the small snippet
// at the bottom of this file to drop into that socket handler.
// ---------------------------------------------------------
const { z } = require("zod");

// POST /api/studyroom/rooms
const createRoomSchema = z.object({
  name: z
    .string({ required_error: "Room name is required." })
    .trim()
    .min(1, "Room name is required.")
    .max(60, "Room name must be under 60 characters."),
});

module.exports = { createRoomSchema };

// ---------------------------------------------------------
// Drop-in replacement for the top of the "send_message" handler
// in sockets/studyroom.socket.js (Socket.io events skip Express
// middleware entirely, so this can't go through validate.middleware.js):
//
//   socket.on("send_message", async ({ roomId, message }) => {
//     try {
//       if (!roomId || typeof message !== "string") return;
//       const trimmed = message.trim();
//       if (!trimmed || trimmed.length > 1000) {
//         return socket.emit("error_message", {
//           error: "Message must be between 1 and 1000 characters.",
//         });
//       }
//       // ...use `trimmed` instead of `message` from here on
// ---------------------------------------------------------