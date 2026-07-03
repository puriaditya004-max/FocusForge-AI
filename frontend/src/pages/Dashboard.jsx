import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import StatCard from "../components/StatCard";
import CurrentTask from "../components/CurrentTask";
import FocusTracker from "../components/FocusTracker";
import { Clock, CheckCircle2, Star } from "lucide-react";

// ---------------------------------------------
// Dashboard Page
// Main landing screen after login.
// Shows: stats row, smart timetable preview,
// current task panel, focus camera card.
//
// Stats + Current Task now come from /api/dashboard
// (real data). Smart Timetable preview stays static
// (same as Timetable.jsx's "Daily Schedule" tab —
// it's a fixed daily routine, not per-user DB data).
// FocusTracker is untouched (handles its own camera).
// ---------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const timetableData = [
  { time: "06:00 AM", title: "Wake Up & Fresh", status: "completed" },
  { time: "07:00 AM", title: "Python – Functions, Loops, OOP", status: "current" },
  { time: "08:00 AM", title: "Break", status: "upcoming" },
  { time: "09:00 AM", title: "Practice Coding", status: "upcoming" },
  { time: "10:00 AM", title: "Data Structures – Arrays", status: "upcoming" },
  { time: "11:00 AM", title: "Build Mini Project", status: "upcoming" },
  { time: "12:00 PM", title: "Lunch & Rest", status: "upcoming" },
];

// Converts seconds -> "05h 20m" style string
function formatStudyTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}h ${mm}m`;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/dashboard`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load dashboard.");
      setDashboardData(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const stats = dashboardData?.stats;
  const currentTask = dashboardData?.currentTask;
  const user = dashboardData?.user;

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <TopBar
          userName={user?.name || "Student"}
          streak={user?.streak || 0}
          level={user?.level || 1}
        />

        {error && (
          <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl p-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="px-6 mt-6 text-gray-400 text-sm">Loading dashboard...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 px-6 mt-4">
              <StatCard
                icon={<div className="text-blue-400">●</div>}
                label="Today's Progress"
                value={`${stats?.progressPercent ?? 0}%`}
                sub="Completed"
              />
              <StatCard
                icon={<Clock className="text-purple-400" size={20} />}
                label="Study Time"
                value={formatStudyTime(stats?.studyTimeSeconds || 0)}
                sub={`/ ${stats?.dailyGoalHours ?? 12}h Goal`}
              />
              <StatCard
                icon={<CheckCircle2 className="text-green-400" size={20} />}
                label="Tasks Completed"
                value={`${stats?.tasksCompleted ?? 0} / ${stats?.tasksTotal ?? 0}`}
                sub="Tasks"
              />
              <StatCard
                icon={<Star className="text-orange-400" size={20} />}
                label="Focus Score"
                value={`${stats?.focusScore ?? 0}%`}
                sub={stats?.focusScore >= 70 ? "Keep it up!" : "Let's improve"}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-6 mt-4">
              {/* Smart Timetable (static preview, same as before) */}
              <section className="lg:col-span-1 bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <h2 className="font-semibold mb-3">Smart Timetable</h2>
                <ul className="space-y-3">
                  {timetableData.map((item) => (
                    <li key={item.time} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">{item.time}</p>
                        <p
                          className={
                            item.status === "current"
                              ? "text-purple-300 font-medium"
                              : "text-gray-200"
                          }
                        >
                          {item.title}
                        </p>
                      </div>
                      <span
                        className={
                          item.status === "completed"
                            ? "text-green-400 text-xs"
                            : item.status === "current"
                            ? "text-purple-400 text-xs"
                            : "text-orange-400 text-xs"
                        }
                      >
                        {item.status === "completed"
                          ? "Done"
                          : item.status === "current"
                          ? "Now"
                          : "Upcoming"}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate("/timetable")}
                  className="w-full mt-3 text-sm text-purple-300 border border-purple-500/30 rounded-xl py-2 hover:bg-purple-700/20 transition-colors"
                >
                  View Full Timetable
                </button>
              </section>

              {/* Current Task — real data, or empty state */}
              <section className="lg:col-span-1 bg-[#13131f] rounded-2xl p-4 border border-white/5">
                {currentTask ? (
                  <CurrentTask
                    title={currentTask.title}
                    description={currentTask.category}
                    timeLeft={null}
                    priority={currentTask.priority}
                    progress={currentTask.progress}
                    subTopics={currentTask.subTopics}
                    onStart={() => navigate("/todays-plan")}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <p className="font-semibold mb-1">No pending tasks 🎉</p>
                    <p className="text-sm text-gray-400 mb-4">
                      All of today's tasks are done, or you haven't added any yet.
                    </p>
                    <button
                      onClick={() => navigate("/todays-plan")}
                      className="text-sm text-purple-300 border border-purple-500/30 rounded-xl px-4 py-2 hover:bg-purple-700/20 transition-colors"
                    >
                      Go to Today's Plan
                    </button>
                  </div>
                )}
              </section>

              {/* Focus Mode camera — untouched */}
              <section className="lg:col-span-1 bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <FocusTracker />
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
