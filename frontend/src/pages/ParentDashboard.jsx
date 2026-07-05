import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Users, Clock, Flame, Target, LogOut, UserPlus } from "lucide-react";

// ---------------------------------------------------------
// Parent Dashboard — real data only.
// Fetches every student linked to this parent via
// GET /api/parent/overview (StudentParentLink table).
// A brand-new parent account with no linked child correctly
// shows an empty state + a form to link one — no fake children.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function ParentDashboard() {
  const { user, logout } = useAuth();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [linkEmail, setLinkEmail] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState("");

  useEffect(() => {
    fetchOverview();
  }, []);

  async function fetchOverview() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/parent/overview`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load overview.");
      setChildren(data.children || []);
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
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 border border-white/10 hover:bg-white/5 px-3 py-1.5 rounded-lg transition"
        >
          <LogOut size={13} /> Log Out
        </button>
      </header>

      <main className="p-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        {/* Link a student form — always available */}
        <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5 mb-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <UserPlus size={16} className="text-purple-400" /> Link Your Child's Account
          </h2>
          <form onSubmit={handleLink} className="flex gap-3">
            <input
              type="email"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              placeholder="Child's account email"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={linking}
              className="bg-purple-600 hover:bg-purple-700 transition text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
            >
              {linking ? "Linking..." : "Link"}
            </button>
          </form>
          {linkMessage && <p className="text-xs text-gray-400 mt-2">{linkMessage}</p>}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : children.length === 0 ? (
          <div className="bg-[#13131f] rounded-2xl p-8 border border-white/5 text-center">
            <p className="font-semibold mb-1">No linked children yet</p>
            <p className="text-sm text-gray-400">
              Enter your child's account email above to see their real study progress here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {children.map((child) => (
              <div key={child.id} className="bg-[#13131f] rounded-2xl p-5 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-700 flex items-center justify-center font-bold">
                    {child.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{child.name}</p>
                    <p className="text-xs text-gray-500">Level {child.level} · {child.xp} XP</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                      <Clock size={12} /> Study Today
                    </div>
                    <p className="text-lg font-semibold">{child.studyHoursToday}h</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                      <Flame size={12} /> Streak
                    </div>
                    <p className="text-lg font-semibold">{child.currentStreak} days</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                      <Target size={12} /> Tasks Today
                    </div>
                    <p className="text-lg font-semibold">
                      {child.tasksCompletedToday}/{child.tasksTotalToday}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                      <Users size={12} /> Focus Score
                    </div>
                    <p className="text-lg font-semibold">{child.focusScoreThisWeek}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}