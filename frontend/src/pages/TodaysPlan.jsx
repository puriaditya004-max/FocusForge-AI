import { useState, useEffect, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Clock,
  Flag,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ListChecks,
  X,
  Loader2,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const priorityColors = {
  High: "text-red-400 bg-red-400/10 border border-red-400/30",
  Medium: "text-yellow-400 bg-yellow-400/10 border border-yellow-400/30",
  Low: "text-green-400 bg-green-400/10 border border-green-400/30",
};

// ---------------------------------------------------------
// Time-chain helpers — all pure functions, no state.
// "Start day at" + each task's duration drives a live-computed
// display time for every pending task; nothing here depends on
// a task's stored `time` field, so re-ordering/edits update
// instantly without extra network calls.
// ---------------------------------------------------------
function parseDurationToMinutes(duration) {
  if (!duration) return 60;
  const str = String(duration).toLowerCase();
  const hMatch = str.match(/(\d+(?:\.\d+)?)\s*h/);
  const mMatch = str.match(/(\d+)\s*m/);
  let minutes = 0;
  if (hMatch) minutes += parseFloat(hMatch[1]) * 60;
  if (mMatch) minutes += parseInt(mMatch[1], 10);
  if (!hMatch && !mMatch) {
    const num = parseFloat(str);
    if (!isNaN(num)) minutes = num;
  }
  return minutes > 0 ? Math.round(minutes) : 60;
}

function minutesToClock(totalMinutes) {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function clockInputToMinutes(hhmm) {
  if (!hhmm) return 8 * 60;
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function TodaysPlan() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", subject: "", time: "", duration: "", priority: "Medium" });
  const [currentFocusText, setCurrentFocusText] = useState("");
  const [dayStartTime, setDayStartTime] = useState("08:00");

  // "Plan my day" panel — self-select vs AI-suggest
  const [showPlanner, setShowPlanner] = useState(false);
  const [plannerTab, setPlannerTab] = useState("self"); // "self" | "ai"
  const [roadmapItems, setRoadmapItems] = useState([]);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [selectedWeeks, setSelectedWeeks] = useState(new Set());
  const [targetHours, setTargetHours] = useState(4);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [buildingPlan, setBuildingPlan] = useState(false);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  useEffect(() => {
    fetchTasks();
    fetchCurrentFocus();
  }, []);

  useEffect(() => {
    if (showPlanner && roadmapItems.length === 0 && !roadmapLoading) {
      fetchRoadmapItems();
    }
  }, [showPlanner]);

  async function fetchTasks() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/tasks?limit=100`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to load tasks");
      setTasks(data.results || []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCurrentFocus() {
    try {
      const res = await fetch(`${API_BASE}/roadmap`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && Array.isArray(data) && data.length > 0) {
        const current =
          data.find((w) => w.status === "IN_PROGRESS") ||
          data.find((w) => w.status !== "COMPLETED") ||
          data[0];
        if (current) setCurrentFocusText(`${current.month} — ${current.topic}`);
      }
    } catch {
      // silent — subtitle just stays empty if this fails, not critical
    }
  }

  async function fetchRoadmapItems() {
    try {
      setRoadmapLoading(true);
      const res = await fetch(`${API_BASE}/roadmap`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setRoadmapItems((data || []).filter((w) => w.status !== "COMPLETED"));
    } catch {
      // silent — planner panel just shows the empty state
    } finally {
      setRoadmapLoading(false);
    }
  }

  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => (a.completed ? 1 : -1)), [tasks]);

  // Live-computed start time per pending task, chained from "Start day at"
  const chainedTimes = useMemo(() => {
    let cursor = clockInputToMinutes(dayStartTime);
    const map = {};
    for (const t of sortedTasks) {
      if (t.completed) continue;
      map[t.id] = cursor;
      cursor += parseDurationToMinutes(t.duration);
    }
    return map;
  }, [sortedTasks, dayStartTime]);

  const toggleTask = async (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/toggle`, { method: "PATCH", credentials: "include" });
      if (!res.ok) throw new Error("Failed to update task");
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setError(err.message || "Failed to update task");
      fetchTasks();
    }
  };

  const toggleSubtask = async (taskId, subId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) }
          : t
      )
    );
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/subtasks/${subId}/toggle`, {
        method: "PATCH", credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update subtask");
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      setError(err.message || "Failed to update subtask");
      fetchTasks();
    }
  };

  const deleteTask = async (id) => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete task");
    } catch (err) {
      setError(err.message || "Failed to delete task");
      setTasks(previous);
    }
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: newTask.title, subject: newTask.subject, priority: newTask.priority,
          time: newTask.time, duration: newTask.duration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to add task");
      setTasks((prev) => [...prev, data]);
      setNewTask({ title: "", subject: "", time: "", duration: "", priority: "Medium" });
      setShowAddForm(false);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to add task");
    }
  };

  const handleDurationBlur = async (taskId, newDuration) => {
    const trimmed = newDuration.trim();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, duration: trimmed } : t)));
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ duration: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to update duration");
    } catch (err) {
      setError(err.message || "Failed to update duration");
      fetchTasks();
    }
  };

  async function addGeneratedTask({ title, subject, duration, priority }) {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title, subject, priority: priority || "Medium", duration }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Failed to add task");
    setTasks((prev) => [...prev, data]);
  }

  function toggleWeekSelect(week) {
    setSelectedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week); else next.add(week);
      return next;
    });
  }

  async function buildFromSelection() {
    if (selectedWeeks.size === 0) return;
    setBuildingPlan(true);
    try {
      const items = roadmapItems.filter((w) => selectedWeeks.has(w.week));
      for (const item of items) {
        await addGeneratedTask({ title: item.topic, subject: item.month, duration: "90 min", priority: "Medium" });
      }
      setSelectedWeeks(new Set());
      setShowPlanner(false);
      setError("");
    } catch (err) {
      setError(err.message || "Could not build your plan");
    } finally {
      setBuildingPlan(false);
    }
  }

  async function fetchAiSuggestions() {
    setSuggesting(true);
    try {
      const res = await fetch(`${API_BASE}/roadmap/suggest-today?hours=${targetHours}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not get suggestions");
      setAiSuggestions(data.suggestions || []);
      if ((data.suggestions || []).length === 0 && data.message) setError(data.message);
      else setError("");
    } catch (err) {
      setError(err.message || "Could not get suggestions");
    } finally {
      setSuggesting(false);
    }
  }

  async function buildFromAiSuggestions() {
    if (aiSuggestions.length === 0) return;
    setBuildingPlan(true);
    try {
      for (const s of aiSuggestions) {
        await addGeneratedTask(s);
      }
      setAiSuggestions([]);
      setShowPlanner(false);
      setError("");
    } catch (err) {
      setError(err.message || "Could not build your plan");
    } finally {
      setBuildingPlan(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0f0f1a] text-white">
      <Sidebar />
      <main className="flex-1 p-4 pt-16 md:p-6 md:pt-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Today's Plan</h1>
          <p className="text-gray-400 text-sm mt-1">{today}</p>
          {currentFocusText && <p className="text-gray-500 text-xs mt-1">{currentFocusText}</p>}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="bg-[#1a1a2e] rounded-2xl p-5 mb-6 border border-white/5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-300 font-medium">Daily Progress</span>
            <span className="text-purple-400 font-bold text-lg">{percent}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3">
            <div className="bg-gradient-to-r from-purple-500 to-violet-400 h-3 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-gray-500 text-sm mt-2">{completed} of {total} tasks completed</p>
        </div>

        {/* Start day at + Plan my day trigger */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 bg-[#1a1a2e] border border-white/5 rounded-xl px-4 py-2">
            <Clock size={16} className="text-purple-400" />
            <span className="text-gray-400 text-sm">Start day at</span>
            <input
              type="time"
              value={dayStartTime}
              onChange={(e) => setDayStartTime(e.target.value)}
              className="bg-transparent text-white text-sm outline-none"
            />
          </div>
          <button
            onClick={() => setShowPlanner((s) => !s)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-xl transition"
          >
            <Sparkles size={16} /> Plan My Day
          </button>
        </div>

        {/* Plan My Day panel */}
        {showPlanner && (
          <div className="bg-[#1a1a2e] rounded-2xl p-5 mb-6 border border-purple-500/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setPlannerTab("self")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${plannerTab === "self" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  <ListChecks size={14} /> Pick myself
                </button>
                <button
                  onClick={() => setPlannerTab("ai")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${plannerTab === "ai" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  <Sparkles size={14} /> Let AI suggest
                </button>
              </div>
              <button onClick={() => setShowPlanner(false)} className="text-gray-500 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            {roadmapLoading ? (
              <p className="text-gray-400 text-sm">Loading your Smart Timetable...</p>
            ) : roadmapItems.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No active plan found — generate a Smart Timetable first, then come back here to build today's plan from it.
              </p>
            ) : plannerTab === "self" ? (
              <>
                <p className="text-gray-500 text-xs mb-3">Pick the topics you want to study today from your Smart Timetable.</p>
                <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                  {roadmapItems.map((w) => (
                    <label
                      key={w.week}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${selectedWeeks.has(w.week) ? "bg-purple-600/10 border-purple-500/40" : "bg-white/5 border-white/10 hover:border-white/20"}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedWeeks.has(w.week)}
                        onChange={() => toggleWeekSelect(w.week)}
                        className="accent-purple-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{w.topic}</p>
                        <p className="text-gray-500 text-xs">{w.month}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  onClick={buildFromSelection}
                  disabled={selectedWeeks.size === 0 || buildingPlan}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded-xl transition"
                >
                  {buildingPlan ? <Loader2 size={16} className="animate-spin" /> : <ListChecks size={16} />}
                  {buildingPlan ? "Building..." : `Build my plan (${selectedWeeks.size})`}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <label className="text-gray-400 text-sm">Target study hours today</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={targetHours}
                    onChange={(e) => setTargetHours(e.target.value)}
                    className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={fetchAiSuggestions}
                    disabled={suggesting}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-xl transition"
                  >
                    {suggesting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Suggest
                  </button>
                </div>

                {aiSuggestions.length > 0 && (
                  <>
                    <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                      {aiSuggestions.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                          <CheckCircle2 size={16} className="text-purple-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{s.title}</p>
                            <p className="text-gray-500 text-xs">{s.subject} · {s.duration}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={buildFromAiSuggestions}
                      disabled={buildingPlan}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-xl transition"
                    >
                      {buildingPlan ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {buildingPlan ? "Building..." : `Use this plan (${aiSuggestions.length})`}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Tasks</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-xl transition"
          >
            <Plus size={16} /> Add Task
          </button>
        </div>

        {showAddForm && (
          <div className="bg-[#1a1a2e] rounded-2xl p-5 mb-4 border border-purple-500/30">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                className="col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-purple-500"
                placeholder="Task title..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
              <input
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-purple-500"
                placeholder="Subject (e.g. Python)"
                value={newTask.subject}
                onChange={(e) => setNewTask({ ...newTask, subject: e.target.value })}
              />
              <select
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-purple-500"
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              >
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
              <input
                type="time"
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-purple-500"
                value={newTask.time}
                onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
              />
              <input
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-purple-500"
                placeholder="Duration (e.g. 45 min)"
                value={newTask.duration}
                onChange={(e) => setNewTask({ ...newTask, duration: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={addTask} className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-5 py-2 rounded-xl transition">
                Save Task
              </button>
              <button onClick={() => setShowAddForm(false)} className="bg-white/10 hover:bg-white/20 text-white text-sm px-5 py-2 rounded-xl transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-gray-400 text-sm">Loading tasks...</p>}
        {!loading && tasks.length === 0 && (
          <p className="text-gray-500 text-sm">No tasks yet — use "Plan My Day" or "Add Task" to create your first one.</p>
        )}

        <div className="space-y-3">
          {sortedTasks.map((task) => (
            <div
              key={task.id}
              className={`bg-[#1a1a2e] rounded-2xl border transition-all ${task.completed ? "border-white/5 opacity-60" : "border-white/10"}`}
            >
              <div className="p-4 flex items-start gap-3">
                <button onClick={() => toggleTask(task.id)} className="mt-1 flex-shrink-0">
                  {task.completed ? (
                    <CheckCircle2 size={22} className="text-purple-400" />
                  ) : (
                    <Circle size={22} className="text-gray-500 hover:text-purple-400 transition" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-base font-medium ${task.completed ? "line-through text-gray-500" : "text-white"}`}>
                      {task.title}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-gray-400 text-xs">
                    {task.subject && <span className="text-purple-400">{task.subject}</span>}
                    {!task.completed && chainedTimes[task.id] !== undefined && (
                      <span className="flex items-center gap-1 text-purple-300">
                        <Clock size={12} /> {minutesToClock(chainedTimes[task.id])}
                      </span>
                    )}
                    {task.completed && task.time && (
                      <span className="flex items-center gap-1"><Clock size={12} /> {task.time}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Flag size={12} />
                      <input
                        type="text"
                        defaultValue={task.duration || ""}
                        onBlur={(e) => handleDurationBlur(task.id, e.target.value)}
                        placeholder="45 min"
                        className="w-16 bg-transparent border-b border-white/10 focus:border-purple-500 outline-none text-xs"
                      />
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {task.subtasks.length > 0 && (
                    <button onClick={() => setExpandedId(expandedId === task.id ? null : task.id)} className="text-gray-400 hover:text-white transition">
                      {expandedId === task.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  )}
                  <button onClick={() => deleteTask(task.id)} className="text-gray-600 hover:text-red-400 transition">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {expandedId === task.id && task.subtasks.length > 0 && (
                <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                  {task.subtasks.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 cursor-pointer" onClick={() => toggleSubtask(task.id, sub.id)}>
                      {sub.done ? (
                        <CheckCircle2 size={16} className="text-purple-400 flex-shrink-0" />
                      ) : (
                        <Circle size={16} className="text-gray-500 flex-shrink-0" />
                      )}
                      <span className={`text-sm ${sub.done ? "line-through text-gray-500" : "text-gray-300"}`}>{sub.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
