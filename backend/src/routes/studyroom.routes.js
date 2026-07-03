// ===========================================================
// Study Room Routes
// ===========================================================

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth.middleware");
const {
  listRooms,
  createRoom,
  joinRoom,
  getRoomMessages,
} = require("../controllers/studyroom.controller");

router.get("/rooms", requireAuth, listRooms);
router.post("/rooms", requireAuth, createRoom);
router.post("/rooms/:roomId/join", requireAuth, joinRoom);
router.get("/rooms/:roomId/messages", requireAuth, getRoomMessages);

module.exports = router;