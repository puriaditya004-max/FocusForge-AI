const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
router.use("/auth", authRoutes);

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
router.use("/parent", require("./parent.routes"));
router.use("/marketplace", require("./marketplace.routes"));
router.use("/teacher", require("./teacher.routes"));

module.exports = router;