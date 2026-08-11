// ---------------------------------------------------------
// controllers/youtube.controller.js
// Live YouTube search and roadmap-aware recommendations using
// YouTube Data API v3.
// ---------------------------------------------------------

const prisma = require("../config/db");
const logger = require("../utils/logger");

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const DEFAULT_SUGGESTED_QUERIES = [
  "study techniques for students",
  "time management for exams",
  "productive study routine",
  "how to revise effectively",
];

function normalizeVideo(item) {
  return {
    videoId: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    channelTitle: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
    publishedAt: item.snippet.publishedAt,
  };
}

async function searchYoutubeApi(query, maxResults = 12) {
  if (!YOUTUBE_API_KEY) {
    const err = new Error("YouTube search is not configured yet. Add YOUTUBE_API_KEY on the server.");
    err.statusCode = 500;
    throw err;
  }

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(
    query
  )}&key=${YOUTUBE_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    logger.error("YouTube API HTTP error:", data);
    const reason = data.error?.errors?.[0]?.reason;
    const err = new Error(
      reason === "quotaExceeded"
        ? "YouTube search quota is exhausted for now. Try again later."
        : "YouTube search is temporarily unavailable."
    );
    err.statusCode = response.status >= 500 ? 502 : response.status;
    throw err;
  }

  if (data.error) {
    logger.error("YouTube API error:", data.error);
    const err = new Error("YouTube search is temporarily unavailable.");
    err.statusCode = 500;
    throw err;
  }

  return (data.items || []).map(normalizeVideo);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function buildRecommendationContext(userId) {
  const today = startOfToday();
  const [tasks, roadmapItems] = await Promise.all([
    prisma.task.findMany({
      where: { userId, date: { gte: today } },
      orderBy: [{ completed: "asc" }, { date: "asc" }, { time: "asc" }, { createdAt: "asc" }],
      take: 5,
    }),
    prisma.roadmapItem.findMany({
      where: { userId },
      orderBy: { weekNumber: "asc" },
      take: 8,
    }),
  ]);

  const currentTask = tasks.find((task) => !task.completed) || tasks[0] || null;
  const activeRoadmap =
    roadmapItems.find((item) => item.status === "IN_PROGRESS") ||
    roadmapItems.find((item) => item.status === "UPCOMING") ||
    roadmapItems[0] ||
    null;

  const queryParts = [
    currentTask?.title,
    currentTask?.category,
    activeRoadmap?.title,
    activeRoadmap?.monthLabel,
  ].filter(Boolean);

  const suggestedQueries = [
    ...queryParts,
    ...roadmapItems
      .slice(0, 4)
      .map((item) => `${item.title} ${item.monthLabel}`.trim())
      .filter(Boolean),
    ...DEFAULT_SUGGESTED_QUERIES,
  ].filter((value, index, list) => value && list.indexOf(value) === index);

  return {
    currentTask: currentTask
      ? {
          id: currentTask.id,
          title: currentTask.title,
          subject: currentTask.category,
        }
      : null,
    roadmapFocus: activeRoadmap
      ? {
          id: activeRoadmap.id,
          weekNumber: activeRoadmap.weekNumber,
          title: activeRoadmap.title,
          monthLabel: activeRoadmap.monthLabel,
        }
      : null,
    query: queryParts.length ? `${queryParts.join(" ")} tutorial for students` : "",
    suggestedQueries,
  };
}

async function searchYoutube(req, res) {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "Search query is required." });
    }

    const results = await searchYoutubeApi(q.trim());
    res.json({ results });
  } catch (err) {
    logger.error("searchYoutube error:", err);
    res.status(err.statusCode || 500).json({
      error: err.message || "Something went wrong while searching YouTube.",
    });
  }
}

async function getRecommendations(req, res) {
  try {
    const userId = req.user.userId;
    const context = await buildRecommendationContext(userId);

    if (!context.query) {
      return res.status(200).json({
        context,
        results: [],
        message: "Create a Smart Timetable or Today's Plan task to get video recommendations.",
      });
    }

    const results = await searchYoutubeApi(context.query, 9);
    res.status(200).json({ context, results });
  } catch (err) {
    logger.error("getRecommendations error:", err);
    res.status(err.statusCode || 500).json({
      error: err.message || "Failed to load YouTube recommendations.",
    });
  }
}

module.exports = { searchYoutube, getRecommendations };
