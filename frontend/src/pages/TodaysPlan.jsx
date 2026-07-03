import { useState, useEffect } from "react";
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
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

const priorityColors = {
  High: "text-red-400 bg-red-400/10 border border-red-400/30",
  Medium: "text-yellow-400 bg-yellow-400/10 border border-yellow-400/30",
  Low: "text-green-400 bg-green-400/10 border border-green-400/30",
};

export default function TodaysPlan() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    subject: "",
    time: "",
    duration: "",
    priority: "Medium",
  });

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // -------------------------------------------------------
  // Fetch tasks from backend on page load
  // -------------------------------------------------------
  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/tasks`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to load tasks");
      }
      setTasks(data);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  // -------------------------------------------------------
  // Toggle a task's completed status
  // -------------------------------------------------------
  const toggleTask = async (id) => {
    // Optimistic update — flip it immediately, then confirm with backend
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/toggle`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update task");
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setError(err.message || "Failed to update task");
      fetchTasks(); // re-sync with backend if something went wrong
    }
  };

  // -------------------------------------------------------
  // Toggle a subtask's completed status
  // -------------------------------------------------------
  const toggleSubtask = async (taskId, subId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subId ? { ...s, done: !s.done } : s
              ),
            }
          : t
      )
    );
    try {
      const res = await fetch(
        `${API_BASE}/tasks/${taskId}/subtasks/${subId}/toggle`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );
      if (!res.ok) throw new Error("Failed to update subtask");
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      setError(err.message || "Failed to update subtask");
      fetchTasks();
    }
  };

  // -------------------------------------------------------
  // Delete a task
  // -------------------------------------------------------
  const deleteTask = async (id) => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete task");
    } catch (err) {
      setError(err.message || "Failed to delete task");
      setTasks(previous); // rollback if delete failed
    }
  };

  // -------------------------------------------------------
  // Add a new task
  // -------------------------------------------------------
  const addTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: newTask.title,
          subject: newTask.subject,
          priority: newTask.priority,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to add task");
      }
      setTasks((prev) => [...prev, data]);
      setNewTask({ title: "", subject: "", time: "", duration: "", priority: "Medium" });
      setShowAddForm(false);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to add task");
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0f0f1a] text-white">
      <Sidebar />
      <main className="flex-1 ml-56 p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Today's Plan</h1>
          <p className="text-gray-400 text-sm mt-1">{today}</p>
          <p className="text-gray-500 text-xs mt-1">
            Week 1 — Month 1: Python Setup, Syntax, Variables, Data Types, Operators, Input/Output
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Progress Bar */}
        <div className="bg-[#1a1a2e] rounded-2xl p-5 mb-6 border border-white/5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-300 font-medium">Daily Progress</span>
            <span className="text-purple-400 font-bold text-lg">{percent}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-purple-500 to-violet-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-gray-500 text-sm mt-2">
            {completed} of {total} tasks completed
          </p>
        </div>

        {/* Add Task Button */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Tasks</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-xl transition"
          >
            <Plus size={16} /> Add Task
          </button>
        </div>

        {/* Add Task Form */}
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
            </div>
            <p className="text-gray-500 text-xs mb-3">
              Note: time & duration fields are coming soon — not saved yet.
            </p>
            <div className="flex gap-2">
              <button
                onClick={addTask}
                className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-5 py-2 rounded-xl transition"
              >
                Save Task
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="bg-white/10 hover:bg-white/20 text-white text-sm px-5 py-2 rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <p className="text-gray-400 text-sm">Loading tasks...</p>
        )}

        {/* Empty state */}
        {!loading && tasks.length === 0 && (
          <p className="text-gray-500 text-sm">
            No tasks yet — click "Add Task" to create your first one.
          </p>
        )}

        {/* Task List */}
        <div className="space-y-3">
          {[...tasks]
            .sort((a, b) => (a.completed ? 1 : -1))
            .map((task) => (
              <div
                key={task.id}
                className={`bg-[#1a1a2e] rounded-2xl border transition-all ${
                  task.completed ? "border-white/5 opacity-60" : "border-white/10"
                }`}
              >
                <div className="p-4 flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="mt-1 flex-shrink-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 size={22} className="text-purple-400" />
                    ) : (
                      <Circle size={22} className="text-gray-500 hover:text-purple-400 transition" />
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-base font-medium ${
                          task.completed ? "line-through text-gray-500" : "text-white"
                        }`}
                      >
                        {task.title}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-gray-400 text-xs">
                      {task.subject && (
                        <span className="text-purple-400">{task.subject}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {task.subtasks.length > 0 && (
                      <button
                        onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
                        className="text-gray-400 hover:text-white transition"
                      >
                        {expandedId === task.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    )}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-gray-600 hover:text-red-400 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Subtasks */}
                {expandedId === task.id && task.subtasks.length > 0 && (
                  <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                    {task.subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => toggleSubtask(task.id, sub.id)}
                      >
                        {sub.done ? (
                          <CheckCircle2 size={16} className="text-purple-400 flex-shrink-0" />
                        ) : (
                          <Circle size={16} className="text-gray-500 flex-shrink-0" />
                        )}
                        <span
                          className={`text-sm ${
                            sub.done ? "line-through text-gray-500" : "text-gray-300"
                          }`}
                        >
                          {sub.title}
                        </span>
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