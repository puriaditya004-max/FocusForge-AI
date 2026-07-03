import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import {
  ShieldAlert,
  AlertTriangle,
  Flame,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  RotateCcw,
} from "lucide-react";

// ---------------------------------------------------------
// Penalties Page — Consequence System
// Data now comes from GET /api/penalties (real backend).
//
// NOTE: Automatic penalty creation (detecting a missed task,
// a broken streak, low focus, etc.) is not implemented yet —
// that needs its own detection logic and will be a future
// step. For now this page reads existing penalty events and
// lets you mark them as redeemed.
// ---------------------------------------------------------

const API_BASE = "http://localhost:5000/api";

const severityConfig = {
  yellow: {
    label: "Yellow Strike",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
    ring: "from-yellow-500 to-amber-400",
  },
  orange: {
    label: "Orange Strike",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/30",
    ring: "from-orange-600 to-orange-400",
  },
  red: {
    label: "Red Strike",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    ring: "from-red-600 to-red-400",
  },
  none: {
    label: "Clean Slate",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    ring: "from-green-600 to-green-400",
  },
};

export default function Penalties() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPenalties();
  }, []);

  async function fetchPenalties() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/penalties`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || "Failed to load penalties");
      }
      setData(json);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load penalties");
    } finally {
      setLoading(false);
    }
  }

  async function markRedeemed(id) {
    setData((prev) => ({
      ...prev,
      events: prev.events.map((e) =>
        e.id === id ? { ...e, resolved: true, redemptionDone: true } : e
      ),
    }));
    try {
      const res = await fetch(`${API_BASE}/penalties/${id}/redeem`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update penalty");
      fetchPenalties();
    } catch (err) {
      setError(err.message || "Failed to update penalty");
      fetchPenalties();
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <TopBar userName={user?.name} streak={0} level={1} />
          <div className="px-6 mt-6">
            <p className="text-gray-400 text-sm">Loading your penalties...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <TopBar userName={user?.name} streak={0} level={1} />
          <div className="px-6 mt-6">
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error || "Something went wrong loading your penalties."}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { events, strikeLevel, strikeCount, totalXpDeducted, redemptionChallenges } = data;
  const cfg = severityConfig[strikeLevel];

  const unresolvedEvents = events.filter((e) => !e.resolved);
  const resolvedEvents = events.filter((e) => e.resolved);

  const currentStreak = 0; // TODO: pull from real User streak once Rewards/Penalties are linked together
  const streakAtRisk = strikeLevel === "red";

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <TopBar userName={user?.name} streak={currentStreak} level={1} />

        <div className="px-6 mt-4 mb-8 flex flex-col gap-5">
          {/* Header */}
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <ShieldAlert className="text-red-400" size={20} />
              Penalties
            </h1>
            <p className="text-sm text-gray-400">
              Consistency matters — missed tasks and broken focus have consequences.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Top stat row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`rounded-2xl p-4 border ${cfg.bg} ${cfg.border}`}>
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <AlertTriangle size={13} className={cfg.color} /> Strike Status
              </p>
              <p className={`text-2xl font-bold ${cfg.color}`}>{cfg.label}</p>
              <p className="text-xs text-gray-500 mt-1">{strikeCount} active strike(s)</p>
            </div>

            <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <Zap size={13} className="text-red-400" /> XP Lost
              </p>
              <p className="text-2xl font-bold text-red-400">-{totalXpDeducted}</p>
              <p className="text-xs text-gray-500 mt-1">from penalties total</p>
            </div>

            <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <Flame size={13} className={streakAtRisk ? "text-red-400" : "text-orange-400"} />
                Streak
              </p>
              <p className={`text-2xl font-bold ${streakAtRisk ? "text-red-400" : "text-orange-400"}`}>
                {currentStreak} days
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {streakAtRisk ? "At risk — red strike active" : "Safe for now"}
              </p>
            </div>

            <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <TrendingDown size={13} className="text-purple-300" /> This Week
              </p>
              <p className="text-2xl font-bold text-purple-300">{events.length} events</p>
              <p className="text-xs text-gray-500 mt-1">{resolvedEvents.length} resolved</p>
            </div>
          </div>

          {/* Strike Meter */}
          <div className="bg-[#13131f] rounded-2xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <ShieldAlert size={16} className="text-red-400" />
                Strike Meter
              </h2>
              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["yellow", "orange", "red"].map((level, i) => {
                const isActive =
                  (level === "yellow" && ["yellow", "orange", "red"].includes(strikeLevel)) ||
                  (level === "orange" && ["orange", "red"].includes(strikeLevel)) ||
                  (level === "red" && strikeLevel === "red");
                const c = severityConfig[level];
                return (
                  <div
                    key={level}
                    className={`rounded-xl p-3 text-center border transition-all ${
                      isActive ? `${c.bg} ${c.border}` : "bg-white/3 border-white/5 opacity-40"
                    }`}
                  >
                    <p className={`text-xs font-semibold ${isActive ? c.color : "text-gray-500"}`}>
                      {i === 0 ? "1st Miss" : i === 1 ? "2nd Miss" : "3rd+ Miss"}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {i === 0 ? "Warning only" : i === 1 ? "-XP penalty" : "Streak/Level hit"}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Strikes reset weekly. Complete a redemption challenge to clear a strike early.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Active Penalties + History */}
            <section className="lg:col-span-2 bg-[#13131f] rounded-2xl p-5 border border-white/5">
              <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Clock size={16} className="text-orange-400" />
                Penalty Log
              </h2>

              {events.length === 0 && (
                <p className="text-gray-500 text-xs">
                  No penalties yet — clean slate! Keep completing your tasks on time. 🎉
                </p>
              )}

              {unresolvedEvents.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Active</p>
                  <div className="space-y-2">
                    {unresolvedEvents.map((e) => {
                      const c = severityConfig[e.severity];
                      return (
                        <div
                          key={e.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border ${c.bg} ${c.border}`}
                        >
                          <XCircle size={16} className={`${c.color} flex-shrink-0 mt-0.5`} />
                          <div className="flex-1">
                            <p className="text-xs text-gray-200">{e.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-medium ${c.color}`}>{c.label}</span>
                              <span className="text-[10px] text-gray-500">{e.date}</span>
                              {e.xpDeducted > 0 && (
                                <span className="text-[10px] text-red-400">-{e.xpDeducted} XP</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => markRedeemed(e.id)}
                            className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center gap-1 flex-shrink-0"
                          >
                            <RotateCcw size={10} /> Mark Redeemed
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {resolvedEvents.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">Resolved</p>
                  <div className="space-y-2">
                    {resolvedEvents.map((e) => {
                      const c = severityConfig[e.severity];
                      return (
                        <div
                          key={e.id}
                          className="flex items-start gap-3 p-3 rounded-xl border bg-white/3 border-white/5 opacity-60"
                        >
                          <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-gray-300 line-through">{e.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-medium ${c.color}`}>{c.label}</span>
                              <span className="text-[10px] text-gray-500">{e.date}</span>
                              {e.redemptionDone && (
                                <span className="text-[10px] text-green-400">Redeemed ✅</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Redemption Challenges */}
            <div className="flex flex-col gap-4">
              <section className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <RotateCcw size={16} className="text-green-400" />
                  Redemption Challenges
                </h2>
                <div className="space-y-2">
                  {redemptionChallenges.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl border bg-green-500/5 border-green-500/15"
                    >
                      <p className="text-xs text-gray-200 leading-snug">{c.title}</p>
                      <p className="text-[10px] text-green-400 mt-1">{c.reward}</p>
                      <span className="text-[10px] text-gray-500">
                        For: {severityConfig[c.forSeverity].label}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="bg-red-500/5 border border-red-500/15 rounded-2xl px-4 py-4 flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400">
                  <span className="text-red-400 font-medium">Heads up:</span> 3 unresolved
                  strikes in a week can lower your Level by 1. Complete a redemption
                  challenge before your next miss to stay safe.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}