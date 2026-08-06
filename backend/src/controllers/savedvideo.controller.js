// ---------------------------------------------------------
// savedvideo.controller.js — YouTube Suggestions bookmarks
// ---------------------------------------------------------
// The video catalog itself stays static/hardcoded on the
// frontend (curated list matched to roadmap topics) — only
// the "saved" bookmark state is persisted here.
//
// NOTE: Most catalog videos don't have a verified real
// YouTube ID yet, so we store the frontend's local catalog
// id (e.g. "1", "2"...) in the `videoId` field as a stable
// key to match against. Once real YouTube IDs are filled in
// on the frontend, this can store those instead — the shape
// doesn't need to change.
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");

// GET /api/saved-videos
const getSavedVideos = async (req, res) => {
  try {
    const userId = req.user.userId;
    const saved = await prisma.savedVideo.findMany({
      where: { userId },
      orderBy: { savedAt: "desc" },
    });
    res.status(200).json(
      saved.map((s) => ({
        id: s.id,
        videoId: s.videoId,
        title: s.title,
        channel: s.channel,
        savedAt: s.savedAt,
      }))
    );
  } catch (err) {
    logger.error("getSavedVideos error:", err);
    res.status(500).json({ message: "Failed to fetch saved videos" });
  }
};

// POST /api/saved-videos
// body: { videoId, title, channel }
const saveVideo = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { videoId, title, channel } = req.body;

    if (!videoId || !title) {
      return res.status(400).json({ message: "videoId and title are required" });
    }

    const existing = await prisma.savedVideo.findFirst({ where: { userId, videoId } });
    if (existing) {
      return res.status(200).json({ id: existing.id, videoId: existing.videoId });
    }

    const created = await prisma.savedVideo.create({
      data: { userId, videoId, title, channel: channel || null },
    });

    res.status(201).json({ id: created.id, videoId: created.videoId });
  } catch (err) {
    logger.error("saveVideo error:", err);
    res.status(500).json({ message: "Failed to save video" });
  }
};

// DELETE /api/saved-videos/:videoId
const unsaveVideo = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { videoId } = req.params;

    const existing = await prisma.savedVideo.findFirst({ where: { userId, videoId } });
    if (!existing) {
      return res.status(404).json({ message: "Saved video not found" });
    }

    await prisma.savedVideo.delete({ where: { id: existing.id } });
    res.status(200).json({ message: "Removed", videoId });
  } catch (err) {
    logger.error("unsaveVideo error:", err);
    res.status(500).json({ message: "Failed to remove saved video" });
  }
};

module.exports = {
  getSavedVideos,
  saveVideo,
  unsaveVideo,
};