// ---------------------------------------------------------
// routes/index.js — combines all feature routers.
// As we build each feature (tasks, roadmap, rewards, etc.)
// we register its router here with one line, same pattern
// as auth below.
// ---------------------------------------------------------
const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
router.use("/auth", authRoutes);

// Coming next (uncomment as each one is built):
router.use("/tasks", require("./task.routes"));
router.use("/roadmap", require("./roadmap.routes"));
router.use("/focus", require("./focus.routes"));
router.use("/rewards", require("./reward.routes"));
router.use("/penalties", require("./penalty.routes"));
router.use("/settings", require("./settings.routes"));
router.use("/certificate-exam", require("./certificate.routes"));
router.use("/saved-videos", require("./savedvideo.routes"));
router.use("/youtube", require("./youtube.routes"));
router.use("/dashboard", require("./dashboard.routes"));
router.use("/studyroom", require("./studyroom.routes"));
router.use("/progress", require("./progress.routes"));
router.use("/mentor", require("./mentor.routes"));

module.exports = router;