import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Users,
  Clock,
  Flame,
  Target,
  LogOut,
  UserPlus,
  RefreshCw,
  Activity,
  BookOpen,
  ShieldCheck,
  Hourglass,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function StatCard({ icon: Icon, label, value, tone = "text-gray-100" }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
        <Icon size={14} /> {label}
      </div>
      <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ParentDashboard() {
  const { user, logout } = useAuth();
  const [children, setChildren] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [linkEmail, setLinkEmail] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState("");

  useEffect(() => {
    fetchOverview();
  }, []);

  const totals = useMemo(() => {
    const studyToday = children.reduce((sum, child) => sum + (child.studyHoursToday || 0), 0);
    const studyWeek = children.reduce((sum, child) => sum + (child.studyHoursThisWeek || 0), 0);
    const completed = children.reduce((sum, child) => sum + (child.tasksCompletedToday || 0), 0);
    const tasks = children.reduce((sum, child) => sum + (child.tasksTotalToday || 0), 0);
    return {
      studyToday: +studyToday.toFixed(1),
      studyWeek: +studyWeek.toFixed(1),
      completed,
      tasks,
    };
  }, [children]);

  async function fetchOverview() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/parent/overview`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load overview.");
      setChildren(data.children || []);
      setPendingRequests(data.pendingRequests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLink(e) {
    e.preventDefault();
    setLinkMessage("");
    if (!linkEmail.trim()) return;

    setLinking(true);
    try {
      const res = await fetch(`${API_BASE}/parent/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ studentEmail: linkEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to link student.");
      setLinkMessage(data.message);
      setLinkEmail("");
      fetchOverview();
    } catch (err) {
      setLinkMessage(err.message);
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div>
          <h1 className="text-lg font-semibold">Parent Dashboard</h1>
          <p className="text-xs text-gray-500">Welcome, {user?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOverview}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 border border-white/10 hover:bg-white/5 px-3 py-1.5 rounded-lg transition"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 border border-white/10 hover:bg-white/5 px-3 py-1.5 rounded-lg transition"
          >
            <LogOut size={13} /> Log Out
          </button>
        </div>
      </header>

      <main className="p-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <UserPlus size={16} className="text-purple-400" /> Link a Student Account
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Enter the student's account email. They must approve before any progress is visible.
              </p>
            </div>
            {pendingRequests.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full">
                <Hourglass size={13} /> {pendingRequests.length} pending
              </span>
            )}
          </div>
          <form onSubmit={handleLink} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              placeholder="student@example.com"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={linking}
              className="bg-purple-600 hover:bg-purple-700 transition text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
            >
              {linking ? "Sending..." : "Send Request"}
            </button>
          </form>
          {linkMessage && <p className="text-xs text-gray-400 mt-2">{linkMessage}</p>}
          {pendingRequests.length > 0 && (
            <div className="mt-3 grid gap-2">
              {pendingRequests.map((request) => (
                <div key={request.id} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200 truncate">{request.studentName}</p>
                    <p className="text-xs text-gray-500 truncate">{request.studentEmail}</p>
                  </div>
                  <span className="text-[10px] text-yellow-300 flex-shrink-0">
                    Sent {formatDate(request.requestedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard icon={Users} label="Linked Students" value={children.length} />
              <StatCard icon={Clock} label="Study Today" value={`${totals.studyToday}h`} tone="text-purple-300" />
              <StatCard icon={BookOpen} label="Study This Week" value={`${totals.studyWeek}h`} tone="text-green-300" />
              <StatCard icon={Target} label="Tasks Today" value={`${totals.completed}/${totals.tasks}`} />
            </div>

            {children.length === 0 ? (
              <div className="bg-[#13131f] rounded-2xl p-8 border border-white/5 text-center">
                <ShieldCheck className="mx-auto text-purple-300 mb-3" size={32} />
                <p className="font-semibold mb-1">No approved student links yet</p>
                <p className="text-sm text-gray-400">
                  Send a request above. Once the student approves it, their study snapshot appears here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {children.map((child) => {
                  const goalPercent = Math.min(
                    Math.round(((child.studyHoursToday || 0) / Math.max(child.dailyGoalHours || 1, 1)) * 100),
                    100
                  );
                  return (
                    <div key={child.id} className="bg-[#13131f] rounded-2xl p-5 border border-white/5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-purple-700 flex items-center justify-center font-bold flex-shrink-0">
                            {child.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{child.name}</p>
                            <p className="text-xs text-gray-500">Level {child.level} · {child.xp} XP</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-500">Streak</p>
                          <p className="text-sm font-semibold text-orange-300 flex items-center gap-1">
                            <Flame size={13} /> {child.currentStreak}d
                          </p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-400">Daily goal</p>
                          <p className="text-xs text-purple-300">
                            {child.studyHoursToday}h / {child.dailyGoalHours}h
                          </p>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${goalPercent}%` }} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <StatCard icon={Clock} label="Today" value={`${child.studyHoursToday}h`} />
                        <StatCard icon={BookOpen} label="This Week" value={`${child.studyHoursThisWeek}h`} />
                        <StatCard icon={Target} label="Tasks" value={`${child.tasksCompletedToday}/${child.tasksTotalToday}`} />
                        <StatCard icon={Activity} label="Focus" value={`${child.focusScoreThisWeek}%`} />
                      </div>

                      {child.currentFocus && (
                        <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3 mb-4">
                          <p className="text-[11px] text-purple-300 uppercase tracking-wider mb-1">Current Smart Timetable Focus</p>
                          <p className="text-sm font-medium text-gray-100">{child.currentFocus.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Week {child.currentFocus.weekNumber} · {child.currentFocus.monthLabel}
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="text-xs text-gray-400 mb-2">Recent Activity</p>
                        {child.recentActivity?.length ? (
                          <div className="space-y-2">
                            {child.recentActivity.map((item) => (
                              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                                <p className="text-xs text-gray-300 truncate">
                                  <span className="mr-1">{item.icon}</span>
                                  {item.text}
                                </p>
                                <span className="text-[10px] text-gray-500 flex-shrink-0">{formatDate(item.createdAt)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-600">No recent activity yet.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
