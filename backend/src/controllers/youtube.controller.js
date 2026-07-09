// ---------------------------------------------------------
// controllers/youtube.controller.js
// Live YouTube search using YouTube Data API v3.
// Does NOT touch savedvideo.controller.js or the curated
// catalog — this is purely for real-time search results.
// ---------------------------------------------------------

const logger = require("../utils/logger");

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

async function searchYoutube(req, res) {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "Search query is required." });
    }

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ error: "YouTube API key not configured on server." });
    }

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(
      q
    )}&key=${YOUTUBE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      logger.error("YouTube API error:", data.error);
      return res.status(500).json({ error: "YouTube API request failed." });
    }

    const results = (data.items || []).map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      publishedAt: item.snippet.publishedAt,
    }));

    res.json({ results });
  } catch (err) {
    logger.error("searchYoutube error:", err);
    res.status(500).json({ error: "Something went wrong while searching YouTube." });
  }
}

module.exports = { searchYoutube };