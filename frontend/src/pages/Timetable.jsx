import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, BookOpen } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const dailySchedule = [
  { time: "06:00 AM – 07:00 AM", task: "Wake Up & Fresh", details: "Exercise / Meditation / Ready", duration: "1 Hour", type: "routine" },
  { time: "07:00 AM – 08:00 AM", task: "Revision", details: "Revise yesterday's topics", duration: "1 Hour", type: "study" },
  { time: "08:00 AM – 10:00 AM", task: "Learn New Topics", details: "Watch YouTube + Take Notes", duration: "2 Hours", type: "study" },
  { time: "10:00 AM – 10:30 AM", task: "Break", details: "Short Break", duration: "30 Min", type: "break" },
  { time: "10:30 AM – 12:30 PM", task: "Practice Coding", details: "Solve examples / Exercises", duration: "2 Hours", type: "study" },
  { time: "12:30 PM – 01:30 PM", task: "Lunch Break", details: "Lunch + Power Nap", duration: "1 Hour", type: "break" },
  { time: "01:30 PM – 03:30 PM", task: "Build Project", details: "Work on Project", duration: "2 Hours", type: "study" },
  { time: "03:30 PM – 04:00 PM", task: "Break", details: "Tea / Walk / Relax", duration: "30 Min", type: "break" },
  { time: "04:00 PM – 06:00 PM", task: "Deep Practice", details: "More coding & problem solving", duration: "2 Hours", type: "study" },
  { time: "06:00 PM – 07:00 PM", task: "Revision & Notes", details: "Make short notes / Flashcards", duration: "1 Hour", type: "study" },
  { time: "07:00 PM – 08:00 PM", task: "Dinner & Rest", details: "Dinner & Family Time", duration: "1 Hour", type: "routine" },
  { time: "08:00 PM – 09:30 PM", task: "Watch & Learn", details: "Watch Tech Videos / Motivation", duration: "1 Hour", type: "study" },
  { time: "09:00 PM – 09:30 PM", task: "Today's Review", details: "What did I learn today?", duration: "30 Min", type: "study" },
  { time: "09:30 PM – 10:00 PM", task: "Plan Tomorrow", details: "Plan next day & set goals", duration: "30 Min", type: "routine" },
  { time: "10:00 PM – 10:30 PM", task: "Read Book (Optional)", details: "Self Improvement", duration: "30 Min", type: "routine" },
  { time: "10:30 PM", task: "Sleep", details: "Minimum 7-8 Hours Sleep", duration: "-", type: "routine" },
];

const typeColors = {
  study: "border-l-purple-500 bg-purple-500/5",
  break: "border-l-yellow-500 bg-yellow-500/5",
  routine: "border-l-blue-500 bg-blue-500/5",
};

const monthColors = {
  "Month 1 – Python & Basics": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Month 2 – Machine Learning": "bg-green-500/20 text-green-300 border-green-500/30",
  "Month 3 – Deep Learning": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Month 4 – AI Advanced & GenAI": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "SE Month 1 – DSA & Basics": "bg-red-500/20 text-red-300 border-red-500/30",
  "SE Month 2 – Web Development": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "SE Month 3 – Backend": "bg-pink-500/20 text-pink-300 border-pink-500/30",
};

export default function Timetable() {
  const [view, setView] = useState("weekly"); // "weekly" | "daily"
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weeklyPlan, setWeeklyPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // -------------------------------------------------------
  // Fetch roadmap from backend on page load
  // (backend auto-seeds the 25-week curriculum on first visit)
  // -------------------------------------------------------
  useEffect(() => {
    fetchRoadmap();
  }, []);

  async function fetchRoadmap() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/roadmap`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to load roadmap");
      }
      setWeeklyPlan(data);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load roadmap");
    } finally {
      setLoading(false);
    }
  }

  const currentData = weeklyPlan.find((w) => w.week === currentWeek);
  const totalWeeks = weeklyPlan.length || 25;

  return (
    <div className="flex min-h-screen bg-[#0f0f1a] text-white">
      <Sidebar />
      <main className="flex-1 ml-56 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Smart Timetable</h1>
            <p className="text-gray-400 text-sm mt-1">AIML + Software Engineer Roadmap — Zero to Job Ready</p>
          </div>
          {/* View Toggle */}
          <div className="flex bg-white/5 rounded-xl p-1 gap-1">
            <button
              onClick={() => setView("weekly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === "weekly" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Weekly Plan
            </button>
            <button
              onClick={() => setView("daily")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === "daily" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Daily Schedule
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {view === "weekly" ? (
          <>
            {loading ? (
              <p className="text-gray-400 text-sm">Loading your roadmap...</p>
            ) : (
              <>
                {/* Week Navigator */}
                <div className="flex items-center justify-between bg-[#1a1a2e] rounded-2xl p-4 mb-4 border border-white/5">
                  <button
                    onClick={() => setCurrentWeek((w) => Math.max(1, w - 1))}
                    className="p-2 hover:bg-white/10 rounded-lg transition"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="text-center">
                    <p className="text-purple-400 text-sm font-medium">{currentData?.month}</p>
                    <p className="text-white text-lg font-bold">Week {currentWeek} of {totalWeeks}</p>
                  </div>
                  <button
                    onClick={() => setCurrentWeek((w) => Math.min(totalWeeks, w + 1))}
                    className="p-2 hover:bg-white/10 rounded-lg transition"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* Current Week Details */}
                {currentData && (
                  <div className="bg-[#1a1a2e] rounded-2xl p-5 border border-white/5 mb-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1">
                        <span className={`text-xs px-2 py-1 rounded-full border font-medium mb-3 inline-block ${monthColors[currentData.month] || "bg-white/10 text-gray-300 border-white/20"}`}>
                          {currentData.month}
                        </span>
                        <h2 className="text-white text-lg font-semibold mt-2 mb-1">{currentData.topic}</h2>
                        <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-400">
                          <span className="flex items-center gap-1"><BookOpen size={14} className="text-purple-400" /> {currentData.tools}</span>
                          <span className="flex items-center gap-1"><Clock size={14} className="text-yellow-400" /> {currentData.hours}/day</span>
                        </div>
                      </div>
                      <div className="bg-purple-600/20 border border-purple-500/30 rounded-xl px-5 py-3 text-center">
                        <p className="text-gray-400 text-xs mb-1">Weekly Project</p>
                        <p className="text-purple-300 font-semibold text-sm">{currentData.project}</p>
                      </div>
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
                        <span className="text-purple-400 text-xs flex-shrink-0">{w.project}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          /* Daily Schedule View */
          <div className="space-y-3">
            <div className="bg-[#1a1a2e] rounded-2xl p-4 border border-white/5 mb-2">
              <p className="text-gray-300 text-sm">📅 Daily Schedule — <span className="text-purple-400 font-medium">6-8 Hours Study Plan</span></p>
            </div>
            {dailySchedule.map((item, i) => (
              <div key={i} className={`bg-[#1a1a2e] rounded-xl p-4 border-l-4 border border-white/5 ${typeColors[item.type]}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-purple-300 text-xs font-medium mb-1">{item.time}</p>
                    <p className="text-white font-semibold text-sm">{item.task}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{item.details}</p>
                  </div>
                  <span className="text-gray-500 text-xs flex-shrink-0">{item.duration}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
