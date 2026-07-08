// ===========================================================
// Study Room Routes
// ===========================================================

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { createRoomSchema } = require("../validators/studyroom.validator");
const {
  listRooms,
  createRoom,
  joinRoom,
  getRoomMessages,
} = require("../controllers/studyroom.controller");

router.get("/rooms", requireAuth, listRooms);
router.post("/rooms", requireAuth, validate(createRoomSchema), createRoom);
router.post("/rooms/:roomId/join", requireAuth, joinRoom);
router.get("/rooms/:roomId/messages", requireAuth, getRoomMessages);

module.exports = router;