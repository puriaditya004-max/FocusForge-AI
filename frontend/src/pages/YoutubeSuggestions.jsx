import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { todaysTasks, getCurrentTask } from "../data/todaysTasks";
import {
  Youtube,
  Search,
  PlayCircle,
  Bookmark,
  BookmarkCheck,
  Clock,
  ExternalLink,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------
// YouTube Suggestions Page
//
// The curated video catalog is still the static list matched
// against today's task (unchanged from before). The "saved"
// bookmark state is real — persisted via
// GET/POST/DELETE /api/saved-videos.
//
// NEW: When the student types something in the search box
// and presses Enter / clicks Search, we now ALSO call our
// backend's real YouTube search (/api/youtube/search) and
// show live YouTube results in a separate section above the
// curated catalog. The curated catalog + its own filtering
// still works exactly as before.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const categories = [
  "All",
  "Python",
  "DSA",
  "Machine Learning",
  "Web Dev",
  "Projects",
];

const videos = [
  {
    id: 1,
    title: "Learn Python - Full Course for Beginners",
    channel: "freeCodeCamp.org",
    duration: "4:26:52",
    views: "45M+ views",
    category: "Python",
    keywords: ["python", "setup", "syntax", "variables", "data types"],
    gradient: "from-purple-600 to-violet-800",
    videoId: "rfscVS0vtbw",
  },
  {
    id: 2,
    title: "Object Oriented Programming (OOP) In Python - Beginner Crash Course",
    channel: "freeCodeCamp.org",
    duration: "1:00:00",
    views: "1.6M+ views",
    category: "Python",
    keywords: ["oop", "class", "object", "inheritance"],
    gradient: "from-blue-600 to-indigo-800",
    videoId: "-pEs-Bss8Wc",
  },
  {
    id: 3,
    title: "Python Operators & Input/Output Explained",
    channel: "CodeWithHarry",
    duration: "18:20",
    views: "320K views",
    category: "Python",
    keywords: ["operators", "input", "output", "arithmetic"],
    gradient: "from-fuchsia-600 to-purple-900",
    videoId: null,
  },
  {
    id: 4,
    title: "Build a Simple Calculator in Python — Step by Step",
    channel: "CodeWithHarry",
    duration: "19:54",
    views: "410K views",
    category: "Projects",
    keywords: ["calculator", "project"],
    gradient: "from-violet-600 to-purple-900",
    videoId: null,
  },
  {
    id: 5,
    title: "Arrays & Strings — DSA for Beginners",
    channel: "Apna College",
    duration: "48:05",
    views: "2.1M views",
    category: "DSA",
    keywords: ["dsa", "arrays", "strings"],
    gradient: "from-pink-600 to-rose-800",
    videoId: null,
  },
  {
    id: 6,
    title: "Linear Regression from Scratch — ML Crash Course",
    channel: "StatQuest",
    duration: "21:33",
    views: "780K views",
    category: "Machine Learning",
    keywords: ["regression", "machine learning", "statistics"],
    gradient: "from-green-600 to-emerald-800",
    videoId: null,
  },
  {
    id: 7,
    title: "React.js Crash Course for Beginners",
    channel: "Traversy Media",
    duration: "1:25:10",
    views: "3.4M views",
    category: "Web Dev",
    keywords: ["react", "web development"],
    gradient: "from-sky-600 to-blue-900",
    videoId: null,
  },
  {
    id: 8,
    title: "HTML + CSS Full Course — Build a Portfolio",
    channel: "freeCodeCamp",
    duration: "2:10:00",
    views: "5.1M views",
    category: "Web Dev",
    keywords: ["html", "css", "portfolio"],
    gradient: "from-orange-600 to-red-800",
    videoId: null,
  },
];

function scoreVideo(video, currentTask) {
  if (!currentTask) return 0;
  const haystack = `${currentTask.title} ${currentTask.subject}`.toLowerCase();
  let score = 0;
  for (const kw of video.keywords) {
    if (haystack.includes(kw)) score += 1;
  }
  if (video.category.toLowerCase() === currentTask.subject.toLowerCase()) {
    score += 1;
  }
  return score;
}

export default function YoutubeSuggestions() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(new Set());
  const [playingVideo, setPlayingVideo] = useState(null);
  const [error, setError] = useState("");

  // ---- NEW: live YouTube search state ----
  const [liveResults, setLiveResults] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const currentTask = useMemo(() => getCurrentTask(todaysTasks), []);

  useEffect(() => {
    fetchSaved();
  }, []);

  async function fetchSaved() {
    try {
      const res = await fetch(`${API_BASE}/saved-videos`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load saved videos");
      setSaved(new Set(data.map((s) => s.videoId)));
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load saved videos");
    }
  }

  const rankedVideos = useMemo(() => {
    return [...videos]
      .map((v) => ({ ...v, score: scoreVideo(v, currentTask) }))
      .sort((a, b) => b.score - a.score);
  }, [currentTask]);

  const filteredVideos = useMemo(() => {
    return rankedVideos.filter((v) => {
      const matchesCategory =
        activeCategory === "All" || v.category === activeCategory;
      const matchesQuery =
        v.title.toLowerCase().includes(query.toLowerCase()) ||
        v.channel.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [rankedVideos, activeCategory, query]);

  async function toggleSave(video) {
    const key = String(video.id);
    const isSaved = saved.has(key);

    // Optimistic update
    setSaved((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(key);
      else next.add(key);
      return next;
    });

    try {
      if (isSaved) {
        const res = await fetch(`${API_BASE}/saved-videos/${key}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to unsave video");
      } else {
        const res = await fetch(`${API_BASE}/saved-videos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            videoId: key,
            title: video.title,
            channel: video.channel,
          }),
        });
        if (!res.ok) throw new Error("Failed to save video");
      }
      setError("");
    } catch (err) {
      setError(err.message || "Failed to update saved video");
      fetchSaved(); // re-sync on failure
    }
  }

  function handleWatch(video) {
    if (video.videoId) {
      setPlayingVideo(video);
    } else {
      const q = encodeURIComponent(`${video.title} ${video.channel}`);
      window.open(`https://www.youtube.com/results?search_query=${q}`, "_blank");
    }
  }

  // ---- NEW: play a live YouTube search result ----
  function handleWatchLive(video) {
    if (video.videoId) {
      setPlayingVideo({
        id: `live-${video.videoId}`,
        title: video.title,
        videoId: video.videoId,
      });
    }
  }

  // ---- NEW: toggle save for a live YouTube search result ----
  async function toggleSaveLive(video) {
    const key = video.videoId;
    const isSaved = saved.has(key);

    setSaved((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(key);
      else next.add(key);
      return next;
    });

    try {
      if (isSaved) {
        const res = await fetch(`${API_BASE}/saved-videos/${key}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to unsave video");
      } else {
        const res = await fetch(`${API_BASE}/saved-videos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            videoId: key,
            title: video.title,
            channel: video.channel,
          }),
        });
        if (!res.ok) throw new Error("Failed to save video");
      }
      setError("");
    } catch (err) {
      setError(err.message || "Failed to update saved video");
      fetchSaved();
    }
  }

  // ---- NEW: call backend -> real YouTube Data API v3 search ----
  async function runLiveSearch() {
    if (!query.trim()) return;

    setLiveLoading(true);
    setLiveError("");
    setHasSearched(true);

    try {
      const res = await fetch(
        `${API_BASE}/youtube/search?q=${encodeURIComponent(query.trim())}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "YouTube search failed");
      setLiveResults(data.results || []);
    } catch (err) {
      setLiveError(err.message || "YouTube search failed");
      setLiveResults([]);
    } finally {
      setLiveLoading(false);
    }
  }

  function handleSearchKeyDown(e) {
    if (e.key === "Enter") {
      runLiveSearch();
    }
  }

  function clearSearch() {
    setQuery("");
    setLiveResults([]);
    setHasSearched(false);
    setLiveError("");
  }

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <TopBar userName={user?.name} streak={12} level={8} />

        <div className="px-6 mt-4 mb-8 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Youtube className="text-red-500" size={20} />
                YouTube Suggestions
              </h1>
              <p className="text-sm text-gray-400">
                Curated videos matched to your current roadmap topics, or
                search YouTube directly for anything.
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search videos or channels... (press Enter to search YouTube)"
                className="w-full bg-[#13131f] border border-white/10 rounded-xl pl-9 pr-16 py-2 text-sm outline-none focus:border-purple-500 placeholder-gray-500"
              />
              {query && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* ---- NEW: Live YouTube search results section ---- */}
          {hasSearched && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Youtube size={16} className="text-red-500" />
                <h2 className="text-sm font-semibold text-gray-200">
                  Live YouTube results for "{query}"
                </h2>
                {liveLoading && (
                  <Loader2 size={14} className="animate-spin text-gray-500" />
                )}
              </div>

              {liveError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                  {liveError}
                </div>
              )}

              {!liveLoading && !liveError && liveResults.length === 0 && (
                <div className="bg-[#13131f] rounded-2xl border border-white/5 p-6 text-center text-gray-500 text-sm">
                  No live results found. Try a different search term.
                </div>
              )}

              {liveResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveResults.map((v) => (
                    <div
                      key={v.videoId}
                      className="bg-[#13131f] rounded-2xl border border-white/5 overflow-hidden flex flex-col hover:border-purple-500/30 transition-colors"
                    >
                      <button
                        onClick={() => handleWatchLive(v)}
                        className="relative aspect-video bg-black flex items-center justify-center group overflow-hidden"
                      >
                        {v.thumbnail ? (
                          <img
                            src={v.thumbnail}
                            alt={v.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-red-600 to-rose-900" />
                        )}
                        <PlayCircle
                          size={42}
                          className="absolute text-white/90 group-hover:scale-110 transition drop-shadow-lg"
                        />
                      </button>

                      <div className="p-4 flex flex-col flex-1">
                        <p className="text-sm font-medium text-gray-100 leading-snug line-clamp-2">
                          {v.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1.5">
                          {v.channel}
                        </p>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                          <button
                            onClick={() => handleWatchLive(v)}
                            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition"
                          >
                            <PlayCircle size={13} /> Play
                          </button>
                          <button
                            onClick={() => toggleSaveLive(v)}
                            className="text-gray-400 hover:text-purple-300 transition"
                          >
                            {saved.has(v.videoId) ? (
                              <BookmarkCheck
                                size={16}
                                className="text-purple-400"
                              />
                            ) : (
                              <Bookmark size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-white/5 pt-4 mt-2">
                <p className="text-xs text-gray-500">
                  Curated suggestions matched to your roadmap, below:
                </p>
              </div>
            </div>
          )}

          {/* Currently studying banner */}
          {currentTask && (
            <div className="bg-purple-700/10 border border-purple-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
              <Sparkles size={18} className="text-purple-300 flex-shrink-0" />
              <p className="text-sm text-gray-300">
                Suggestions tailored to your current task:{" "}
                <span className="text-purple-300 font-medium">
                  {currentTask.title}
                </span>
              </p>
            </div>
          )}

          {/* Category filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  activeCategory === cat
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Video grid */}
          {filteredVideos.length === 0 ? (
            <div className="bg-[#13131f] rounded-2xl border border-white/5 p-10 text-center text-gray-500 text-sm">
              No videos match your search. Try a different keyword or
              category.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map((v) => (
                <div
                  key={v.id}
                  className="bg-[#13131f] rounded-2xl border border-white/5 overflow-hidden flex flex-col hover:border-purple-500/30 transition-colors"
                >
                  {/* Thumbnail */}
                  <button
                    onClick={() => handleWatch(v)}
                    className={`relative aspect-video bg-gradient-to-br ${v.gradient} flex items-center justify-center group`}
                  >
                    <PlayCircle
                      size={42}
                      className="text-white/80 group-hover:scale-110 transition"
                    />
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Clock size={10} /> {v.duration}
                    </span>
                    {v.score > 0 && (
                      <span className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                  </button>

                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1">
                    <p className="text-sm font-medium text-gray-100 leading-snug line-clamp-2">
                      {v.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {v.channel} · {v.views}
                    </p>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                      <button
                        onClick={() => handleWatch(v)}
                        className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition"
                      >
                        {v.videoId ? (
                          <>
                            <PlayCircle size={13} /> Play
                          </>
                        ) : (
                          <>
                            <ExternalLink size={13} /> Find on YouTube
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => toggleSave(v)}
                        className="text-gray-400 hover:text-purple-300 transition"
                      >
                        {saved.has(String(v.id)) ? (
                          <BookmarkCheck
                            size={16}
                            className="text-purple-400"
                          />
                        ) : (
                          <Bookmark size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-600 text-center mt-2">
            Showing {filteredVideos.length} of {videos.length} curated videos
            · Press Enter in the search box for live YouTube results.
          </p>
        </div>
      </main>

      {/* Inline video player modal */}
      {playingVideo && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
          onClick={() => setPlayingVideo(null)}
        >
          <div
            className="bg-[#13131f] rounded-2xl border border-white/10 w-full max-w-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <p className="text-sm font-medium text-gray-200 truncate pr-4">
                {playingVideo.title}
              </p>
              <button
                onClick={() => setPlayingVideo(null)}
                className="text-gray-400 hover:text-white transition flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            <div className="aspect-video bg-black">
              <iframe
                key={playingVideo.id}
                src={`https://www.youtube.com/embed/${playingVideo.videoId}?autoplay=1`}
                title={playingVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
