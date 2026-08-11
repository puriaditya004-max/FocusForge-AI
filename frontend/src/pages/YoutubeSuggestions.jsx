import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import {
  Youtube,
  Search,
  PlayCircle,
  Bookmark,
  BookmarkCheck,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function YoutubeSuggestions() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(new Set());
  const [playingVideo, setPlayingVideo] = useState(null);
  const [error, setError] = useState("");
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [recommendationContext, setRecommendationContext] = useState(null);
  const [recommendationLoading, setRecommendationLoading] = useState(true);
  const [recommendationError, setRecommendationError] = useState("");
  const [liveResults, setLiveResults] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetchSaved();
    fetchRecommendations();
  }, []);

  async function fetchRecommendations() {
    try {
      setRecommendationLoading(true);
      const res = await fetch(`${API_BASE}/youtube/recommendations`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to load recommendations");
      setRecommendedVideos(data.results || []);
      setRecommendationContext(data.context || null);
      setRecommendationError("");
    } catch (err) {
      setRecommendedVideos([]);
      setRecommendationError(err.message || "Failed to load recommendations");
    } finally {
      setRecommendationLoading(false);
    }
  }

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

  const filteredVideos = useMemo(() => {
    return recommendedVideos.filter((v) => {
      if (!query.trim() || hasSearched) return true;
      const channel = v.channel || v.channelTitle || "";
      return (
        v.title.toLowerCase().includes(query.toLowerCase()) ||
        channel.toLowerCase().includes(query.toLowerCase())
      );
    });
  }, [recommendedVideos, query, hasSearched]);

  async function toggleSave(video) {
    const key = video.videoId;
    if (!key) return;
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
            channel: video.channel || video.channelTitle,
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

  function handleWatch(video) {
    if (!video.videoId) return;
    setPlayingVideo(video);
  }

  async function runLiveSearch(searchTerm = query) {
    const trimmedQuery = searchTerm.trim();
    if (!trimmedQuery) return;

    setQuery(trimmedQuery);
    setLiveLoading(true);
    setLiveError("");
    setHasSearched(true);

    try {
      const res = await fetch(
        `${API_BASE}/youtube/search?q=${encodeURIComponent(trimmedQuery)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "YouTube search failed");
      setLiveResults(data.results || []);
    } catch (err) {
      setLiveError(err.message || "YouTube search failed");
      setLiveResults([]);
    } finally {
      setLiveLoading(false);
    }
  }

  function handleSearchKeyDown(e) {
    if (e.key === "Enter") runLiveSearch();
  }

  function clearSearch() {
    setQuery("");
    setLiveResults([]);
    setHasSearched(false);
    setLiveError("");
  }

  const roadmapTitle =
    recommendationContext?.currentTask?.title ||
    recommendationContext?.roadmapFocus?.title ||
    null;

  const suggestedQueries = recommendationContext?.suggestedQueries || [];

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <TopBar userName={user?.name} streak={user?.currentStreak ?? 0} level={user?.level ?? 1} />

        <div className="px-6 mt-4 mb-8 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Youtube className="text-red-500" size={20} />
                YouTube Suggestions
              </h1>
              <p className="text-sm text-gray-400">
                Videos matched to your roadmap and today's plan, with live YouTube search.
              </p>
            </div>

            <div className="relative w-full sm:w-96">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search videos or channels..."
                className="w-full bg-[#13131f] border border-white/10 rounded-xl pl-9 pr-24 py-2 text-sm outline-none focus:border-purple-500 placeholder-gray-500"
              />
              {query && (
                <button
                  onClick={clearSearch}
                  className="absolute right-16 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
              <button
                onClick={() => runLiveSearch()}
                disabled={!query.trim() || liveLoading}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Search
              </button>
            </div>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          {recommendationContext && (
            <div className="bg-purple-700/10 border border-purple-500/20 rounded-2xl px-4 py-3 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Sparkles size={18} className="text-purple-300 flex-shrink-0" />
                <p className="text-sm text-gray-300">
                  {roadmapTitle ? (
                    <>
                      Suggestions tailored to:{" "}
                      <span className="text-purple-300 font-medium">{roadmapTitle}</span>
                    </>
                  ) : (
                    "Create a Smart Timetable or Today's Plan task to get tailored videos."
                  )}
                </p>
              </div>

              {suggestedQueries.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-0 sm:pl-8">
                  {suggestedQueries.slice(0, 5).map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => runLiveSearch(suggestion)}
                      className="rounded-full border border-purple-400/25 bg-purple-500/10 px-3 py-1 text-xs text-purple-100 hover:border-purple-300/50 hover:bg-purple-500/20"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {recommendationError && <Alert tone="danger">{recommendationError}</Alert>}

          {hasSearched && (
            <VideoSection
              title={`Live YouTube results for "${query}"`}
              videos={liveResults}
              loading={liveLoading}
              error={liveError}
              saved={saved}
              onWatch={handleWatch}
              onSave={toggleSave}
              emptyText="No live results found. Try a suggested topic or a different search term."
            />
          )}

          <VideoSection
            title="Roadmap-matched recommendations"
            videos={filteredVideos}
            loading={recommendationLoading}
            saved={saved}
            onWatch={handleWatch}
            onSave={toggleSave}
            emptyText="No recommendations yet. Use a suggested topic or search YouTube directly above."
          />

          <p className="text-xs text-gray-600 text-center mt-2">
            Showing {filteredVideos.length} roadmap-matched videos. Suggested topics use your latest roadmap and plan context.
          </p>
        </div>
      </main>

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

function Alert({ children, tone = "info" }) {
  const classes =
    tone === "danger"
      ? "bg-red-500/10 border-red-500/30 text-red-300"
      : "bg-purple-500/10 border-purple-500/30 text-purple-200";

  return (
    <div className={`border text-sm rounded-xl px-4 py-3 ${classes}`}>
      {children}
    </div>
  );
}

function VideoSection({ title, videos, loading, error, saved, onWatch, onSave, emptyText }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Youtube size={16} className="text-red-500" />
        <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
        {loading && <Loader2 size={14} className="animate-spin text-gray-500" />}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="bg-[#13131f] rounded-2xl border border-white/5 p-10 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading videos...
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-[#13131f] rounded-2xl border border-white/5 p-10 text-center text-gray-500 text-sm">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((v) => (
            <div
              key={v.videoId}
              className="bg-[#13131f] rounded-2xl border border-white/5 overflow-hidden flex flex-col hover:border-purple-500/30 transition-colors"
            >
              <button
                onClick={() => onWatch(v)}
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
                  {v.channel || v.channelTitle}
                </p>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                  <button
                    onClick={() => onWatch(v)}
                    className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition"
                  >
                    <PlayCircle size={13} /> Play
                  </button>
                  <button
                    onClick={() => onSave(v)}
                    className="text-gray-400 hover:text-purple-300 transition"
                  >
                    {saved.has(v.videoId) ? (
                      <BookmarkCheck size={16} className="text-purple-400" />
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
    </div>
  );
}
