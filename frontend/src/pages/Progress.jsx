import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import {
  TrendingUp,
  Flame,
  Target,
  Clock,
  Award,
  CalendarDays,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// ---------------------------------------------------------
// Progress Page
// Professional analytics dashboard for study progress.
// Data comes from GET /api/progress/stats, which aggregates
// FocusSession, Task, and RoadmapItem tables for the
// logged-in user.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
      <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
        {icon}
        {label}
      </div>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label, suffix = "" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-medium">
          {p.name}: {p.value}
          {suffix}
        </p>
      ))}
    </div>
  );
}

export default function Progress() {
  const { user } = useAuth();
  const [range, setRange] = useState("week"); // week | month (UI toggle only, backend currently returns week)
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/progress/stats`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to load progress");
      }
      setStats(data);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load progress");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <TopBar userName={user?.name} streak={0} level={8} />
          <div className="px-6 mt-6">
            <p className="text-gray-400 text-sm">Loading your progress...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <TopBar userName={user?.name} streak={0} level={8} />
          <div className="px-6 mt-6">
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error || "Something went wrong loading your progress."}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const {
    weeklyStudyData,
    focusTrendData,
    taskCompletionData,
    subjectDistribution,
    totalHours,
    weeklyGoalHours,
    weeklyGoalPercent,
    avgFocus,
    totalCompleted,
    totalPending,
    currentStreak,
    longestStreak,
    roadmap,
  } = stats;

  const goalCompletion = [{ name: "Weekly Goal", value: weeklyGoalPercent, fill: "#a855f7" }];

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <TopBar userName={user?.name} streak={currentStreak} level={8} />

        <div className="px-6 mt-4 mb-8 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="text-purple-400" size={20} />
                Progress Overview
              </h1>
              <p className="text-sm text-gray-400">
                Week {roadmap.currentWeek} of {roadmap.totalWeeks} — AIML + Software Engineer Roadmap
              </p>
            </div>

            <div className="flex items-center gap-1 bg-[#13131f] border border-white/5 rounded-xl p-1">
              {["week", "month"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    range === r
                      ? "bg-purple-600 text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Clock size={14} />}
              label="Total Study Time"
              value={`${totalHours}h`}
              sub={`This week / ${weeklyGoalHours}h goal`}
              accent="text-purple-300"
            />
            <StatCard
              icon={<Target size={14} />}
              label="Avg Focus Score"
              value={`${avgFocus}%`}
              sub="Across 7 days"
              accent="text-green-400"
            />
            <StatCard
              icon={<Award size={14} />}
              label="Tasks Completed"
              value={`${totalCompleted} / ${totalCompleted + totalPending}`}
              sub={`${totalPending} pending`}
              accent="text-blue-400"
            />
            <StatCard
              icon={<Flame size={14} />}
              label="Current Streak"
              value={`${currentStreak} days`}
              sub={`Best: ${longestStreak} days`}
              accent="text-orange-400"
            />
          </div>

          {/* Row 1: Study hours + Weekly goal radial */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="lg:col-span-2 bg-[#13131f] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">Study Hours (Daily vs Goal)</h2>
                <span className="text-xs text-gray-500">Last 7 days</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={weeklyStudyData} margin={{ left: -16, right: 8 }}>
                  <defs>
                    <linearGradient id="hoursFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="day" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip suffix="h" />} />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    name="Hours Studied"
                    stroke="#a855f7"
                    strokeWidth={2.5}
                    fill="url(#hoursFill)"
                  />
                  <Line
                    type="monotone"
                    dataKey="goal"
                    name="Daily Goal"
                    stroke="#6b7280"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </section>

            <section className="bg-[#13131f] rounded-2xl p-4 border border-white/5 flex flex-col">
              <h2 className="font-semibold text-sm mb-1">Weekly Goal</h2>
              <p className="text-xs text-gray-500 mb-2">{weeklyGoalHours}h target</p>
              <ResponsiveContainer width="100%" height={220}>
                <RadialBarChart
                  innerRadius="70%"
                  outerRadius="100%"
                  data={goalCompletion}
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "#ffffff10" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="text-center -mt-32 mb-20">
                <p className="text-3xl font-bold text-purple-300">{weeklyGoalPercent}%</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
            </section>
          </div>

          {/* Row 2: Focus trend + Subject distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="lg:col-span-2 bg-[#13131f] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">Focus Score Trend</h2>
                <span className="text-xs text-gray-500">Avg {avgFocus}%</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={focusTrendData} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="day" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip content={<CustomTooltip suffix="%" />} />
                  <Line
                    type="monotone"
                    dataKey="focus"
                    name="Focus Score"
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#22c55e" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </section>

            <section className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
              <h2 className="font-semibold text-sm mb-3">Time by Subject</h2>
              {subjectDistribution.length === 0 ? (
                <p className="text-gray-500 text-xs">
                  No focus sessions yet this week — complete a session to see this chart.
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={subjectDistribution}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {subjectDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip suffix="h" />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {subjectDistribution.map((s) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-gray-300">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name}
                        </span>
                        <span className="text-gray-500">{s.value}h</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>

          {/* Row 3: Task completion bar chart */}
          <section className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Tasks Completed vs Pending</h2>
              <span className="text-xs text-gray-500">
                {totalCompleted} done · {totalPending} pending
              </span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={taskCompletionData} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="day" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "#9ca3af" }}
                  iconType="circle"
                />
                <Bar dataKey="completed" name="Completed" fill="#a855f7" radius={[6, 6, 0, 0]} stackId="a" />
                <Bar dataKey="pending" name="Pending" fill="#ffffff20" radius={[6, 6, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Roadmap progress */}
          <section className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <CalendarDays size={16} className="text-purple-400" />
                Roadmap Progress
              </h2>
              <span className="text-xs text-gray-500">
                Week {roadmap.currentWeek} of {roadmap.totalWeeks}
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-violet-400 rounded-full"
                style={{ width: `${roadmap.percent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {roadmap.percent}% of the full AIML + Software Engineer roadmap completed. Keep going! 🔥
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
