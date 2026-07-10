import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import {
  User,
  CalendarClock,
  SlidersHorizontal,
  Bell,
  Palette,
  Database,
  Info,
  Award,
  Camera,
  Check,
  ChevronRight,
  Download,
  Trash2,
  AlertTriangle,
  X,
  BookOpen,
  Flame,
  Clock,
  Bot,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";

// ---------------------------------------------------------
// Settings Page — Profile, Timetable Customization, Study
// Preferences, Notifications, Appearance, Account & Data, About.
//
// Profile/Timetable/Preferences/Notifications/Appearance now
// load and save from GET/PATCH /api/settings (real backend).
//
// Certificates, Courses, and My Journey are still placeholder
// — they depend on the Certificate Exam feature, not built yet.
//
// "Reset all progress" is still UI-only for now (no backend
// wipe logic yet) to avoid accidental data loss during
// development/testing.
//
// AI Mentor API Key (BYOK) — Account & Data tab. Optional.
// If empty, AI Mentor uses the app's free shared tier.
// If a student adds their own key, their mentor chats use it.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const certificatesEarned = [
  {
    id: "CERT-PY-M1-2025",
    title: "Python – Month 1 Foundations",
    score: 98,
    date: "Jan 20, 2025",
  },
];

const coursesInProgress = [
  { name: "DSA – Month 2", progress: 34 },
  { name: "Machine Learning – Month 3", progress: 0 },
];

const journeyMilestones = [
  { label: "Joined FocusForge AI", date: "Dec 2024", done: true },
  { label: "Completed Month 1 – Python Foundations", date: "Jan 2025", done: true },
  { label: "Earned first certificate", date: "Jan 2025", done: true },
  { label: "Started Month 2 – DSA", date: "Jan 2025", done: true },
  { label: "Complete Month 2", date: "Feb 2025 (est.)", done: false },
];

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const accentOptions = [
  { id: "purple", label: "Purple", swatch: "bg-purple-500" },
  { id: "blue", label: "Blue", swatch: "bg-blue-500" },
  { id: "green", label: "Green", swatch: "bg-emerald-500" },
  { id: "orange", label: "Orange", swatch: "bg-orange-500" },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors flex-shrink-0 ${
        checked ? "bg-purple-600 justify-end" : "bg-white/10 justify-start"
      }`}
    >
      <span className="w-5 h-5 rounded-full bg-white block shadow" />
    </button>
  );
}

function SectionCard({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="bg-[#13131f] rounded-2xl border border-white/5 p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-purple-300" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "timetable", label: "Timetable", icon: CalendarClock },
  { id: "preferences", label: "Study Preferences", icon: SlidersHorizontal },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "account", label: "Account & Data", icon: Database },
  { id: "about", label: "About", icon: Info },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState(""); // "" | "saving" | "saved"

  // Local editable state, initialized from backend once loaded
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("22:00");
  const [offDays, setOffDays] = useState(["Sun"]);
  const [dailyGoal, setDailyGoal] = useState(6);
  const [breakInterval, setBreakInterval] = useState(45);
  const [focusSensitivity, setFocusSensitivity] = useState("medium");
  const [notifs, setNotifs] = useState({
    dailyReminder: true,
    reminderTime: "07:30",
    streakAlert: true,
    weeklySummary: false,
  });
  const [theme, setTheme] = useState("dark");
  const [accent, setAccent] = useState("purple");

  // AI Mentor — BYOK (Bring Your Own Key)
  const [mentorApiKey, setMentorApiKey] = useState(""); // only ever holds a NEW key being typed — never prefilled
  const [maskedApiKey, setMaskedApiKey] = useState(""); // masked display of the currently-saved key, e.g. "sk-ant-...4f2a"
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false); // true if backend already has a key stored

  // Read-only profile info from backend
  const [level, setLevel] = useState(1);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [joinedDate, setJoinedDate] = useState("");

  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/settings`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to load settings");
      }

      setName(data.name);
      setStartTime(data.studyStartTime);
      setEndTime(data.studyEndTime);
      setOffDays(data.offDays);
      setDailyGoal(data.dailyGoalHours);
      setBreakInterval(data.breakIntervalMin);
      setFocusSensitivity(data.focusSensitivity);
      setNotifs({
        dailyReminder: data.dailyReminderOn,
        reminderTime: data.reminderTime,
        streakAlert: data.streakAlertOn,
        weeklySummary: data.weeklySummaryOn,
      });
      setTheme(data.theme);
      setAccent(data.accentColor);
      setLevel(data.level);
      setCurrentStreak(data.currentStreak);
      setJoinedDate(data.joinedDate);
      setMentorApiKey(""); // never prefill — the backend only ever sends a masked value
      setMaskedApiKey(data.mentorApiKey || "");
      setApiKeySaved(Boolean(data.hasMentorApiKey));
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  // Sends a partial update to the backend
  async function saveSettings(partial) {
    try {
      setSaveStatus("saving");
      const res = await fetch(`${API_BASE}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(partial),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save");
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 1500);
      return data;
    } catch (err) {
      setError(err.message || "Failed to save settings");
      setSaveStatus("");
      return null;
    }
  }

  function toggleOffDay(day) {
    const updated = offDays.includes(day)
      ? offDays.filter((d) => d !== day)
      : [...offDays, day];
    setOffDays(updated);
    saveSettings({ offDays: updated });
  }

  async function handleSaveApiKey() {
    const trimmed = mentorApiKey.trim();
    if (!trimmed) return; // nothing typed — use the Remove button to clear instead
    const data = await saveSettings({ mentorApiKey: trimmed });
    if (data) {
      setApiKeySaved(Boolean(data.hasMentorApiKey));
      setMaskedApiKey(data.mentorApiKey || "");
      setMentorApiKey(""); // clear the typed value now that it's saved server-side
    }
  }

  async function handleRemoveApiKey() {
    setMentorApiKey("");
    const data = await saveSettings({ mentorApiKey: null });
    if (data) {
      setApiKeySaved(false);
      setMaskedApiKey("");
    }
  }

  function handleExport() {
    const data = {
      profile: { name, level, currentStreak, joinedDate },
      timetable: { startTime, endTime, offDays, dailyGoal },
      certificates: certificatesEarned,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "focusforge-progress.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <TopBar userName="Aryan" streak={0} level={1} />
          <div className="px-6 mt-6">
            <p className="text-gray-400 text-sm">Loading your settings...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <TopBar userName={name || "Student"} streak={currentStreak} level={level} />

        <div className="px-6 mt-4 mb-8">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <SlidersHorizontal className="text-purple-300" size={20} />
                Settings
              </h1>
              <p className="text-sm text-gray-400">
                Manage your profile, timetable, and app preferences.
              </p>
            </div>
            {saveStatus === "saving" && (
              <span className="text-xs text-gray-500">Saving...</span>
            )}
            {saveStatus === "saved" && (
              <span className="text-xs text-green-400">Saved ✅</span>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 items-start">
            {/* Tab navigation */}
            <nav className="bg-[#13131f] rounded-2xl border border-white/5 p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-purple-600/15 text-purple-200 border border-purple-500/20"
                        : "text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent"
                    }`}
                  >
                    <Icon size={15} className={isActive ? "text-purple-300" : "text-gray-500"} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Tab content */}
            <div className="flex flex-col gap-5">
              {/* ---------------- PROFILE ---------------- */}
              {activeTab === "profile" && (
                <>
                  <SectionCard icon={User} title="Profile" subtitle="Your basic account information">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-xl font-bold text-white">
                          {name.charAt(0)}
                        </div>
                        <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1c1c2b] border border-white/10 flex items-center justify-center">
                          <Camera size={11} className="text-gray-300" />
                        </button>
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] text-gray-500 mb-1 block">Display name</label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onBlur={() => saveSettings({ name })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                      <div>
                        <p className="text-[11px] text-gray-500">Level</p>
                        <p className="text-sm font-semibold text-yellow-400 mt-0.5">Lv. {level}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500">Joined</p>
                        <p className="text-sm font-semibold text-gray-200 mt-0.5">{joinedDate}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500">Current streak</p>
                        <p className="text-sm font-semibold text-orange-400 mt-0.5 flex items-center gap-1">
                          <Flame size={12} /> {currentStreak} days
                        </p>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon={Award}
                    title="Certificates & Courses"
                    subtitle="Everything you've completed so far"
                  >
                    <p className="text-[10px] text-gray-600 mb-3">
                      (Sample data — connects to real data once Certificate Exam is built)
                    </p>
                    <div className="mb-4">
                      <p className="text-[11px] text-gray-500 mb-2 font-medium">
                        Certificates earned ({certificatesEarned.length})
                      </p>
                      {certificatesEarned.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/20 mb-2"
                        >
                          <div className="w-9 h-9 rounded-lg bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center flex-shrink-0">
                            <Award size={16} className="text-yellow-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-100 truncate">{c.title}</p>
                            <p className="text-[10px] text-gray-500">{c.date} · {c.id}</p>
                          </div>
                          <span className="text-xs font-bold text-green-400 flex-shrink-0">{c.score}%</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500 mb-2 font-medium">
                        Courses in progress ({coursesInProgress.length})
                      </p>
                      <div className="space-y-2">
                        {coursesInProgress.map((c) => (
                          <div key={c.name} className="p-3 rounded-xl bg-white/3 border border-white/5">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-gray-300 flex items-center gap-1.5">
                                <BookOpen size={12} className="text-purple-300" /> {c.name}
                              </span>
                              <span className="text-[10px] text-gray-500">{c.progress}%</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full"
                                style={{ width: `${c.progress}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard icon={ChevronRight} title="My Journey" subtitle="Your milestones so far">
                    <p className="text-[10px] text-gray-600 mb-3">(Sample data for now)</p>
                    <div className="flex flex-col gap-0">
                      {journeyMilestones.map((m, i) => (
                        <div key={m.label} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                m.done
                                  ? "bg-purple-600 text-white"
                                  : "bg-white/5 border border-white/10 text-gray-600"
                              }`}
                            >
                              {m.done ? <Check size={12} /> : <span className="text-[10px]">{i + 1}</span>}
                            </div>
                            {i < journeyMilestones.length - 1 && (
                              <div className={`w-px flex-1 min-h-[24px] ${m.done ? "bg-purple-500/40" : "bg-white/10"}`} />
                            )}
                          </div>
                          <div className="pb-5">
                            <p className={`text-xs font-medium ${m.done ? "text-gray-200" : "text-gray-500"}`}>
                              {m.label}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{m.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </>
              )}

              {/* ---------------- TIMETABLE ---------------- */}
              {activeTab === "timetable" && (
                <SectionCard
                  icon={CalendarClock}
                  title="Timetable Customization"
                  subtitle="Set your own study hours — Smart Timetable will follow this"
                >
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="text-[11px] text-gray-500 mb-1 block">Study start time</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        onBlur={() => saveSettings({ studyStartTime: startTime })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500 mb-1 block">Study end time</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        onBlur={() => saveSettings({ studyEndTime: endTime })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>

                  <div className="mb-5">
                    <label className="text-[11px] text-gray-500 mb-2 block">Weekly off days</label>
                    <div className="flex gap-2 flex-wrap">
                      {weekDays.map((day) => (
                        <button
                          key={day}
                          onClick={() => toggleOffDay(day)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            offDays.includes(day)
                              ? "bg-purple-600/20 border-purple-500/40 text-purple-200"
                              : "bg-white/3 border-white/10 text-gray-400 hover:bg-white/5"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">
                      Off days won't appear in your Smart Timetable roadmap.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] text-gray-500">Daily study goal</label>
                      <span className="text-xs font-semibold text-purple-300">{dailyGoal} hours</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      value={dailyGoal}
                      onChange={(e) => setDailyGoal(Number(e.target.value))}
                      onMouseUp={() => saveSettings({ dailyGoalHours: dailyGoal })}
                      onTouchEnd={() => saveSettings({ dailyGoalHours: dailyGoal })}
                      className="w-full accent-purple-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                      <span>1h</span>
                      <span>12h</span>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* ---------------- STUDY PREFERENCES ---------------- */}
              {activeTab === "preferences" && (
                <SectionCard
                  icon={SlidersHorizontal}
                  title="Study Preferences"
                  subtitle="Fine-tune how the app supports your study sessions"
                >
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Clock size={12} /> Break reminder interval
                      </label>
                      <span className="text-xs font-semibold text-purple-300">{breakInterval} min</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="90"
                      step="5"
                      value={breakInterval}
                      onChange={(e) => setBreakInterval(Number(e.target.value))}
                      onMouseUp={() => saveSettings({ breakIntervalMin: breakInterval })}
                      onTouchEnd={() => saveSettings({ breakIntervalMin: breakInterval })}
                      className="w-full accent-purple-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      You'll get a gentle nudge to take a break every {breakInterval} minutes.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-500 mb-2 block">
                      Focus Mode sensitivity
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {["low", "medium", "high"].map((level) => (
                        <button
                          key={level}
                          onClick={() => {
                            setFocusSensitivity(level);
                            saveSettings({ focusSensitivity: level });
                          }}
                          className={`py-2.5 rounded-xl text-xs font-medium capitalize border transition-all ${
                            focusSensitivity === level
                              ? "bg-purple-600/20 border-purple-500/40 text-purple-200"
                              : "bg-white/3 border-white/10 text-gray-400 hover:bg-white/5"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">
                      Higher sensitivity flags distractions faster during Focus Mode sessions.
                    </p>
                  </div>
                </SectionCard>
              )}

              {/* ---------------- NOTIFICATIONS ---------------- */}
              {activeTab === "notifications" && (
                <SectionCard
                  icon={Bell}
                  title="Notifications"
                  subtitle="Choose what FocusForge AI reminds you about"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between py-3 border-b border-white/5">
                      <div>
                        <p className="text-xs font-medium text-gray-200">Daily study reminder</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Get reminded to start your session
                        </p>
                      </div>
                      <Toggle
                        checked={notifs.dailyReminder}
                        onChange={(v) => {
                          setNotifs((p) => ({ ...p, dailyReminder: v }));
                          saveSettings({ dailyReminderOn: v });
                        }}
                      />
                    </div>

                    {notifs.dailyReminder && (
                      <div className="flex items-center justify-between py-3 border-b border-white/5 pl-1">
                        <p className="text-xs text-gray-400">Reminder time</p>
                        <input
                          type="time"
                          value={notifs.reminderTime}
                          onChange={(e) =>
                            setNotifs((p) => ({ ...p, reminderTime: e.target.value }))
                          }
                          onBlur={() => saveSettings({ reminderTime: notifs.reminderTime })}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between py-3 border-b border-white/5">
                      <div>
                        <p className="text-xs font-medium text-gray-200">Streak-at-risk alert</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Warn me before I lose my streak
                        </p>
                      </div>
                      <Toggle
                        checked={notifs.streakAlert}
                        onChange={(v) => {
                          setNotifs((p) => ({ ...p, streakAlert: v }));
                          saveSettings({ streakAlertOn: v });
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-xs font-medium text-gray-200">Weekly progress summary</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          A recap of your week, every Sunday
                        </p>
                      </div>
                      <Toggle
                        checked={notifs.weeklySummary}
                        onChange={(v) => {
                          setNotifs((p) => ({ ...p, weeklySummary: v }));
                          saveSettings({ weeklySummaryOn: v });
                        }}
                      />
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* ---------------- APPEARANCE ---------------- */}
              {activeTab === "appearance" && (
                <SectionCard
                  icon={Palette}
                  title="Appearance"
                  subtitle="Personalize how FocusForge AI looks"
                >
                  <div className="mb-5">
                    <label className="text-[11px] text-gray-500 mb-2 block">Theme</label>
                    <div className="grid grid-cols-2 gap-3">
                      {["dark", "light"].map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setTheme(t);
                            saveSettings({ theme: t });
                          }}
                          className={`flex items-center gap-2 p-3 rounded-xl border capitalize text-xs font-medium transition-all ${
                            theme === t
                              ? "bg-purple-600/20 border-purple-500/40 text-purple-200"
                              : "bg-white/3 border-white/10 text-gray-400 hover:bg-white/5"
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full border border-white/20 ${
                              t === "dark" ? "bg-[#0b0b14]" : "bg-gray-100"
                            }`}
                          />
                          {t}
                          {t === "light" && (
                            <span className="text-[9px] text-gray-500 ml-auto">Coming soon</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-500 mb-2 block">Accent color</label>
                    <div className="flex gap-3">
                      {accentOptions.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            setAccent(a.id);
                            saveSettings({ accentColor: a.id });
                          }}
                          className="flex flex-col items-center gap-1.5"
                        >
                          <span
                            className={`w-9 h-9 rounded-full ${a.swatch} flex items-center justify-center border-2 ${
                              accent === a.id ? "border-white" : "border-transparent"
                            }`}
                          >
                            {accent === a.id && <Check size={14} className="text-white" />}
                          </span>
                          <span className="text-[10px] text-gray-500">{a.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* ---------------- ACCOUNT & DATA ---------------- */}
              {activeTab === "account" && (
                <>
                  <SectionCard
                    icon={Bot}
                    title="AI Mentor API Key"
                    subtitle="Optional — bring your own key for a premium AI mentor experience"
                  >
                    <div className="mb-4 p-3 rounded-xl bg-purple-500/5 border border-purple-500/15">
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        By default, AI Mentor uses FocusForge's free shared AI tier — no
                        setup needed. If you add your own Anthropic (Claude) API key here,
                        your mentor chats will use it instead for a more capable AI.
                      </p>
                    </div>

                    <label className="text-[11px] text-gray-500 mb-1 block">
                      Your Anthropic API Key
                    </label>
                    <div className="flex gap-2 mb-2">
                      <div className="relative flex-1">
                        <KeyRound
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                        />
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={mentorApiKey}
                          onChange={(e) => setMentorApiKey(e.target.value)}
                          placeholder={apiKeySaved ? `Saved: ${maskedApiKey} — type to replace` : "sk-ant-api03-..."}
                          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-9 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-500/50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <button
                        onClick={handleSaveApiKey}
                        className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-xs font-medium text-white flex-shrink-0"
                      >
                        Save
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-gray-500">
                        {apiKeySaved
                          ? `✅ Custom key active (${maskedApiKey}) — your mentor chats use your own key.`
                          : "No key saved — using the free shared tier."}
                      </p>
                      {apiKeySaved && (
                        <button
                          onClick={handleRemoveApiKey}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          Remove key
                        </button>
                      )}
                    </div>

                    <p className="text-[10px] text-gray-600 mt-3">
                      Get a key at{" "}
                      <span className="text-purple-300">console.anthropic.com</span> — your
                      key is stored securely and only used for your own AI Mentor chats.
                    </p>
                  </SectionCard>

                  <SectionCard
                    icon={Database}
                    title="Account & Data"
                    subtitle="Manage your local progress data"
                  >
                    <div className="flex items-center justify-between py-3 border-b border-white/5">
                      <div>
                        <p className="text-xs font-medium text-gray-200">Export your progress</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Download a copy as a JSON file
                        </p>
                      </div>
                      <button
                        onClick={handleExport}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-200"
                      >
                        <Download size={13} /> Export
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-xs font-medium text-red-400">Reset all progress</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Clears XP, badges, streaks, and history — cannot be undone
                        </p>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          (Not yet wired to the backend — coming in a later step)
                        </p>
                      </div>
                      <button
                        onClick={() => setShowResetModal(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs text-red-400"
                      >
                        <Trash2 size={13} /> Reset
                      </button>
                    </div>
                  </SectionCard>
                </>
              )}

              {/* ---------------- ABOUT ---------------- */}
              {activeTab === "about" && (
                <SectionCard icon={Info} title="About FocusForge AI" subtitle="App information">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-white">
                      F
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-100">FocusForge AI</p>
                      <p className="text-xs text-gray-500">Version 1.0.0 · Frontend build</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed mb-4">
                    Discipline today, freedom tomorrow. FocusForge AI helps students plan,
                    track, and stay accountable to their self-study roadmap — from daily
                    tasks to certified milestones.
                  </p>
                  <div className="flex items-center justify-between py-3 border-t border-white/5">
                    <p className="text-xs text-gray-300">Send feedback</p>
                    <ChevronRight size={14} className="text-gray-500" />
                  </div>
                </SectionCard>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Reset confirmation modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-gray-500 hover:text-gray-300">
                <X size={16} />
              </button>
            </div>
            <h3 className="text-sm font-semibold text-gray-100 mb-1.5">Reset all progress?</h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-5">
              This will permanently clear your XP, level, badges, streaks, and penalty
              history. Certificates already earned will not be affected. This action
              cannot be undone.
            </p>
            <p className="text-[10px] text-gray-600 mb-4">
              (This isn't connected to the backend yet — nothing will actually be deleted.)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-xs text-white font-medium"
              >
                Yes, reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
