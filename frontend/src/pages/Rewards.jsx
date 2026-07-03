import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import {
  Trophy,
  Flame,
  Star,
  Zap,
  Lock,
  CheckCircle2,
  Target,
  Award,
  TrendingUp,
  Gift,
  GraduationCap,
  ArrowRight,
} from "lucide-react";

// ---------------------------------------------------------
// Rewards Page — Student Gamification System
// XP, Levels, Badges, and Daily Challenges now come from
// GET /api/rewards (real backend data).
//
// Streak Milestones stay computed client-side from the real
// currentStreak value (they're just fixed thresholds, no
// need for their own table).
//
// Recent Activity and the Certificate eligibility section
// are still placeholder/dummy — Recent Activity needs a new
// activity-log table (not built yet), and Certificate ties
// into the Certificate Exam feature (also not built yet).
// Both will be connected in later steps.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const streakMilestoneDefs = [
  { days: 7, label: "Week Warrior", icon: "🥉", color: "from-orange-700 to-amber-600" },
  { days: 14, label: "Fortnight Focus", icon: "🥈", color: "from-slate-400 to-gray-300" },
  { days: 21, label: "21 Day Legend", icon: "🥇", color: "from-yellow-500 to-amber-400" },
  { days: 50, label: "Unstoppable", icon: "💎", color: "from-cyan-500 to-blue-400" },
  { days: 100, label: "100 Day Master", icon: "👑", color: "from-purple-500 to-violet-400" },
];

// Still placeholder — no activity-log table yet
const recentActivity = [
  { icon: "✅", text: "Task Crusher badge unlocked", xp: "+150 XP", time: "2 hrs ago" },
  { icon: "🔥", text: "12-day streak maintained", xp: "+10 XP", time: "Today" },
  { icon: "⭐", text: "Daily challenge completed", xp: "+30 XP", time: "Today" },
  { icon: "📖", text: "Python – Syntax task done", xp: "+20 XP", time: "This morning" },
];

// Still placeholder — ties into the Certificate Exam feature (not built yet)
const monthProgress = 100;
const projectsCompleted = 2;
const projectsRequired = 2;
const certificateEligible = monthProgress >= 100 && projectsCompleted >= projectsRequired;

export default function Rewards() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRewards();
  }, []);

  async function fetchRewards() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/rewards`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || "Failed to load rewards");
      }
      setData(json);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load rewards");
    } finally {
      setLoading(false);
    }
  }

  async function toggleChallenge(id) {
    // Optimistic update
    setData((prev) => ({
      ...prev,
      challenges: prev.challenges.map((c) =>
        c.id === id ? { ...c, done: !c.done } : c
      ),
    }));
    try {
      const res = await fetch(`${API_BASE}/rewards/challenges/${id}/toggle`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update challenge");
      // Re-fetch so XP/level totals stay accurate
      fetchRewards();
    } catch (err) {
      setError(err.message || "Failed to update challenge");
      fetchRewards();
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <TopBar userName={user?.name} streak={0} level={1} />
          <div className="px-6 mt-6">
            <p className="text-gray-400 text-sm">Loading your rewards...</p>
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
              {error || "Something went wrong loading your rewards."}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const XP_PER_LEVEL = data.xpPerLevel;
  const currentLevel = Math.floor(data.totalXP / XP_PER_LEVEL) + 1;
  const currentXP = data.totalXP % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - currentXP;
  const xpPercent = Math.round((currentXP / XP_PER_LEVEL) * 100);

  const currentStreak = data.currentStreak;
  const badges = data.badges;
  const challenges = data.challenges;

  const streakMilestones = streakMilestoneDefs.map((m) => ({
    ...m,
    unlocked: currentStreak >= m.days,
  }));

  const unlockedBadges = badges.filter((b) => b.unlocked).length;
  const nextMilestone = streakMilestones.find((m) => !m.unlocked);
  const daysToNextMilestone = nextMilestone ? nextMilestone.days - currentStreak : 0;

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <TopBar userName={user?.name} streak={currentStreak} level={currentLevel} />

        <div className="px-6 mt-4 mb-8 flex flex-col gap-5">
          {/* Header */}
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="text-yellow-400" size={20} />
              Rewards
            </h1>
            <p className="text-sm text-gray-400">
              Earn XP, unlock badges, and level up as you study.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Top stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <Zap size={13} className="text-yellow-400" /> Current Level
              </p>
              <p className="text-3xl font-bold text-yellow-400">Lv. {currentLevel}</p>
              <p className="text-xs text-gray-500 mt-1">Keep going!</p>
            </div>

            <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <Star size={13} className="text-purple-300" /> Total XP
              </p>
              <p className="text-3xl font-bold text-purple-300">{data.totalXP}</p>
              <p className="text-xs text-gray-500 mt-1">{xpToNextLevel} XP to Level {currentLevel + 1}</p>
            </div>

            <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <Flame size={13} className="text-orange-400" /> Current Streak
              </p>
              <p className="text-3xl font-bold text-orange-400">{currentStreak} days</p>
              <p className="text-xs text-gray-500 mt-1">
                {nextMilestone ? `${daysToNextMilestone} days to next milestone` : "All milestones unlocked!"}
              </p>
            </div>

            <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <Award size={13} className="text-green-400" /> Badges Earned
              </p>
              <p className="text-3xl font-bold text-green-400">
                {unlockedBadges}/{badges.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {badges.length - unlockedBadges} badges remaining
              </p>
            </div>
          </div>

          {/* XP Progress bar */}
          <div className="bg-[#13131f] rounded-2xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-sm font-bold text-yellow-400">
                  {currentLevel}
                </div>
                <div>
                  <p className="text-sm font-medium">Level {currentLevel} → {currentLevel + 1}</p>
                  <p className="text-xs text-gray-500">{currentXP} / {XP_PER_LEVEL} XP</p>
                </div>
              </div>
              <span className="text-sm font-bold text-yellow-400">{xpPercent}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Earn {xpToNextLevel} more XP to reach Level {currentLevel + 1} 🚀
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Badges grid */}
            <section className="lg:col-span-2 bg-[#13131f] rounded-2xl p-5 border border-white/5">
              <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Award size={16} className="text-yellow-400" />
                Badges
                <span className="text-xs text-gray-500 font-normal ml-1">
                  {unlockedBadges} unlocked
                </span>
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${
                      badge.unlocked
                        ? "bg-purple-600/10 border-purple-500/30"
                        : "bg-white/3 border-white/5 opacity-50"
                    }`}
                  >
                    <span className="text-2xl">{badge.icon}</span>
                    <p className={`text-xs font-medium leading-tight ${badge.unlocked ? "text-gray-200" : "text-gray-500"}`}>
                      {badge.title}
                    </p>
                    <p className="text-[10px] text-gray-500 leading-tight">{badge.desc}</p>
                    <span className={`text-[10px] font-medium mt-0.5 ${badge.unlocked ? "text-yellow-400" : "text-gray-600"}`}>
                      +{badge.xp} XP
                    </span>
                    {!badge.unlocked && (
                      <div className="absolute top-2 right-2">
                        <Lock size={10} className="text-gray-600" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Right column */}
            <div className="flex flex-col gap-4">
              {/* Daily Challenges */}
              <section className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Target size={16} className="text-green-400" />
                  Daily Challenges
                </h2>
                <div className="space-y-2">
                  {challenges.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => toggleChallenge(c.id)}
                      className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                        c.done
                          ? "bg-green-500/10 border-green-500/20 opacity-70"
                          : "bg-white/3 border-white/5 hover:bg-white/5"
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {c.done ? (
                          <CheckCircle2 size={16} className="text-green-400" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-gray-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs leading-snug ${c.done ? "line-through text-gray-500" : "text-gray-300"}`}>
                          {c.title}
                        </p>
                        <span className="text-[10px] text-yellow-400 font-medium">+{c.xp} XP</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recent Activity */}
              <section className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <TrendingUp size={16} className="text-purple-400" />
                  Recent Activity
                </h2>
                <div className="space-y-2">
                  {recentActivity.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-base flex-shrink-0">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 truncate">{item.text}</p>
                        <p className="text-[10px] text-gray-600">{item.time}</p>
                      </div>
                      <span className="text-[10px] text-green-400 font-medium flex-shrink-0">
                        {item.xp}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-600 mt-2">
                  (Sample data — real activity feed coming soon)
                </p>
              </section>
            </div>
          </div>

          {/* Streak Milestones */}
          <section className="bg-[#13131f] rounded-2xl p-5 border border-white/5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Flame size={16} className="text-orange-400" />
              Streak Milestones
              <span className="text-xs text-gray-500 font-normal ml-1">
                Currently at {currentStreak} days
              </span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {streakMilestones.map((m) => (
                <div
                  key={m.days}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border text-center ${
                    m.unlocked
                      ? `bg-gradient-to-b ${m.color} border-white/20`
                      : "bg-white/3 border-white/5 opacity-40"
                  }`}
                >
                  <span className="text-3xl">{m.icon}</span>
                  <p className="text-xs font-semibold text-white">{m.label}</p>
                  <p className="text-[11px] text-white/70">{m.days} day streak</p>
                  {m.unlocked ? (
                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">
                      Unlocked ✅
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Lock size={9} />
                      {m.days - currentStreak} days away
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ----------------------------------------------------- */}
          {/* Monthly Certificate section — still placeholder data. */}
          {/* Will connect once Certificate Exam feature is built.  */}
          {/* ----------------------------------------------------- */}
          <section className="bg-gradient-to-br from-[#1a1530] to-[#13131f] rounded-2xl p-5 border border-yellow-500/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center flex-shrink-0">
                  <GraduationCap size={22} className="text-yellow-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    Monthly Certificate
                    {certificateEligible && (
                      <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20">
                        Eligible
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1 max-w-md">
                    Finish this month's roadmap and required projects, then clear a
                    97%+ scoring exam to unlock an official FocusForge AI certificate.
                  </p>

                  {/* Eligibility checklist */}
                  <div className="flex flex-col gap-1 mt-3">
                    <div className="flex items-center gap-2 text-xs">
                      {monthProgress >= 100 ? (
                        <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
                      ) : (
                        <div className="w-[13px] h-[13px] rounded-full border border-gray-600 flex-shrink-0" />
                      )}
                      <span className={monthProgress >= 100 ? "text-gray-300" : "text-gray-500"}>
                        Month roadmap completed ({monthProgress}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {projectsCompleted >= projectsRequired ? (
                        <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
                      ) : (
                        <div className="w-[13px] h-[13px] rounded-full border border-gray-600 flex-shrink-0" />
                      )}
                      <span className={projectsCompleted >= projectsRequired ? "text-gray-300" : "text-gray-500"}>
                        Projects completed ({projectsCompleted}/{projectsRequired})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-[13px] h-[13px] rounded-full border border-gray-600 flex-shrink-0" />
                      <span className="text-gray-500">Exam score 97%+ required (max 2 attempts)</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate("/certificate-exam")}
                disabled={!certificateEligible}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  certificateEligible
                    ? "bg-gradient-to-r from-yellow-500 to-amber-400 text-black hover:opacity-90"
                    : "bg-white/5 text-gray-500 cursor-not-allowed border border-white/10"
                }`}
              >
                {certificateEligible ? (
                  <>
                    Claim Certificate <ArrowRight size={15} />
                  </>
                ) : (
                  <>
                    <Lock size={13} /> Locked
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Bonus XP tip */}
          <div className="bg-purple-700/10 border border-purple-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
            <Gift size={20} className="text-purple-300 flex-shrink-0" />
            <p className="text-sm text-gray-300">
              <span className="text-purple-300 font-medium">Tip:</span> Complete all 3 daily challenges today to earn a{" "}
              <span className="text-yellow-400 font-medium">bonus 50 XP</span> and get closer to your next badge unlock!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
