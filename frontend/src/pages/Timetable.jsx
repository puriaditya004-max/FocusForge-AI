import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { ChevronLeft, ChevronRight, Clock, BookOpen, Mic, Sparkles, Loader2 } from "lucide-react";
import { listenOnce, isVoiceInputSupported } from "../utils/voice";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const MONTH_PALETTE = [
  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "bg-green-500/20 text-green-300 border-green-500/30",
  "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "bg-red-500/20 text-red-300 border-red-500/30",
  "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "bg-pink-500/20 text-pink-300 border-pink-500/30",
];

function monthColorFor(monthNumber) {
  const idx = ((Number(monthNumber) || 1) - 1) % MONTH_PALETTE.length;
  return MONTH_PALETTE[idx] || MONTH_PALETTE[0];
}

// AI-generated monthLabel looks like "<Topic> — Month 1: <phase>" —
// pull just the topic part out for the page heading.
function deriveTopicHeading(plan) {
  if (!plan || plan.length === 0) return "";
  const label = plan[0].month || "";
  const idx = label.indexOf("—");
  return idx > -1 ? label.slice(0, idx).trim() : label;
}

export default function Timetable() {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weeklyPlan, setWeeklyPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [promptText, setPromptText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const voiceSupported = isVoiceInputSupported();

  useEffect(() => {
    fetchRoadmap();
  }, []);

  async function fetchRoadmap() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/roadmap`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to load roadmap");
      setWeeklyPlan(data);
      if (data.length > 0) setCurrentWeek(1);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load roadmap");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!promptText.trim() || generating) return;
    try {
      setGenerating(true);
      setGenError("");
      const res = await fetch(`${API_BASE}/roadmap/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt: promptText.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || data.message || "Could not generate your plan");
      }
      setWeeklyPlan(data.weeks || []);
      setCurrentWeek(1);
      setPromptText("");
      setGenError("");
    } catch (err) {
      setGenError(err.message || "Could not generate your plan");
    } finally {
      setGenerating(false);
    }
  }

  function handleMicClick() {
    if (isListening || generating) return;
    if (!voiceSupported) {
      setGenError("Voice input isn't supported in this browser. Try Chrome or Edge, or type your request.");
      return;
    }
    setGenError("");
    setIsListening(true);
    listenOnce({
      onResult: (transcript) => setPromptText(transcript),
      onError: (err) => setGenError(err.message || "Couldn't hear that — try again or type your request."),
      onEnd: () => setIsListening(false),
    });
  }

  const currentData = weeklyPlan.find((w) => w.week === currentWeek);
  const totalWeeks = weeklyPlan.length;
  const topicHeading = deriveTopicHeading(weeklyPlan);

  return (
    <div className="flex min-h-screen bg-[#0f0f1a] text-white">
      <Sidebar />
      <main className="flex-1 ml-56 p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Smart Timetable</h1>
          <p className="text-gray-400 text-sm mt-1">
            {topicHeading ? `Your plan: ${topicHeading}` : "AI-generated, week-by-week study plan"}
          </p>
        </div>

        {/* Generate / Regenerate box */}
        <div className="bg-[#1a1a2e] rounded-2xl p-4 border border-purple-500/20 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-purple-400" />
            <p className="text-sm font-medium text-gray-200">
              {totalWeeks > 0 ? "Regenerate your plan" : "Tell Forge AI what plan you want"}
            </p>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500"
              placeholder='e.g. "2 month plan for NEET Biology" or "6 month plan for JEE Physics"'
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
              disabled={generating}
            />
            <button
              onClick={handleMicClick}
              disabled={generating}
              title={voiceSupported ? "Speak your request" : "Voice input not supported in this browser"}
              className={`px-3 rounded-xl border transition flex-shrink-0 ${
                isListening
                  ? "bg-red-600/20 border-red-500/40 text-red-300 animate-pulse"
                  : "bg-white/5 border-white/10 text-gray-300 hover:text-white hover:border-purple-500/40"
              }`}
            >
              <Mic size={18} />
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || !promptText.trim()}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-5 py-2.5 rounded-xl transition flex-shrink-0"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
          {genError && <p className="text-red-400 text-xs mt-2">{genError}</p>}
          {totalWeeks > 0 && !genError && (
            <p className="text-gray-500 text-xs mt-2">Generating a new plan replaces your current one.</p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 text-sm">Loading your plan...</p>
        ) : totalWeeks === 0 ? (
          <div className="bg-[#1a1a2e] rounded-2xl p-8 border border-white/5 text-center">
            <BookOpen size={32} className="text-purple-400 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">No study plan yet</p>
            <p className="text-gray-400 text-sm">
              Type or speak what you want above — e.g. "1 month plan for Class 10 Science" — and Forge AI will build it.
            </p>
          </div>
        ) : (
          <>
            {/* Week Navigator */}
            <div className="flex items-center justify-between bg-[#1a1a2e] rounded-2xl p-4 mb-4 border border-white/5">
              <button onClick={() => setCurrentWeek((w) => Math.max(1, w - 1))} className="p-2 hover:bg-white/10 rounded-lg transition">
                <ChevronLeft size={20} />
              </button>
              <div className="text-center">
                <p className="text-purple-400 text-sm font-medium">{currentData?.month}</p>
                <p className="text-white text-lg font-bold">Week {currentWeek} of {totalWeeks}</p>
              </div>
              <button onClick={() => setCurrentWeek((w) => Math.min(totalWeeks, w + 1))} className="p-2 hover:bg-white/10 rounded-lg transition">
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Current Week Details */}
            {currentData && (
              <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/5 mb-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1">
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium mb-3 inline-block ${monthColorFor(currentData.monthNumber)}`}>
                      {currentData.month}
                    </span>
                    <h2 className="text-white text-lg font-semibold mt-2 mb-1">{currentData.topic}</h2>
                    <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-400">
                      {currentData.tools && (
                        <span className="flex items-center gap-1"><BookOpen size={14} className="text-purple-400" /> {currentData.tools}</span>
                      )}
                      {currentData.hours && (
                        <span className="flex items-center gap-1"><Clock size={14} className="text-yellow-400" /> {currentData.hours}/day</span>
                      )}
                    </div>
                  </div>
                  {currentData.project && (
                    <div className="bg-purple-600/20 border border-purple-500/30 rounded-xl px-5 py-3 text-center">
                      <p className="text-gray-400 text-xs mb-1">Weekly Goal</p>
                      <p className="text-purple-300 font-semibold text-sm">{currentData.project}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* All Weeks Overview */}
            <div className="bg-[#1a1a2e] rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <h3 className="text-sm font-semibold text-gray-300">All Weeks Overview</h3>
              </div>
              <div className="divide-y divide-white/5">
                {weeklyPlan.map((w) => (
                  <div
                    key={w.week}
                    onClick={() => setCurrentWeek(w.week)}
                    className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition hover:bg-white/5 ${currentWeek === w.week ? "bg-purple-600/10" : ""}`}
                  >
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${currentWeek === w.week ? "bg-purple-600 text-white" : "bg-white/5 text-gray-400"}`}>
                      W{w.week}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{w.topic}</p>
                      <p className="text-gray-500 text-xs">{w.month}</p>
                    </div>
                    {w.project && <span className="text-purple-400 text-xs flex-shrink-0">{w.project}</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
