// ===========================================================
// Study Room Routes
// ===========================================================

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth.middleware");
const { requireFeature } = require("../middleware/requireFeature.middleware");
const validate = require("../middleware/validate.middleware");
const { createRoomSchema } = require("../validators/studyroom.validator");
const {
  listRooms,
  createRoom,
  joinRoom,
  getRoomMessages,
  reportMessage,
} = require("../controllers/studyroom.controller");

const requireStudyRoom = requireFeature("studyRoom", {
  message: "Study Room is temporarily disabled for the public launch.",
});

router.use(requireStudyRoom);

router.get("/rooms", requireAuth, listRooms);
router.post("/rooms", requireAuth, validate(createRoomSchema), createRoom);
router.post("/rooms/:roomId/join", requireAuth, joinRoom);
router.get("/rooms/:roomId/messages", requireAuth, getRoomMessages);
router.post("/rooms/:roomId/messages/:messageId/report", requireAuth, reportMessage);

module.exports = router;
