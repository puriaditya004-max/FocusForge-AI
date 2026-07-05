import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  BookOpen,
  Users,
  IndianRupee,
  LogOut,
  Plus,
  Clock3,
  Check,
  X as XIcon,
  Phone,
} from "lucide-react";

// ---------------------------------------------------------
// Teacher Dashboard — real data + enrollment approval flow.
// "Enrollment Requests" shows every PENDING student request
// with their contact number. The teacher confirms payment
// themselves (call/UPI check) then Approves or Rejects —
// only Approved requests count toward real students/earnings.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [respondingId, setRespondingId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      setError(null);
      const [overviewRes, requestsRes] = await Promise.all([
        fetch(`${API_BASE}/teacher/overview`, { credentials: "include" }),
        fetch(`${API_BASE}/teacher/enrollment-requests`, { credentials: "include" }),
      ]);
      const overviewData = await overviewRes.json();
      const requestsData = await requestsRes.json();
      if (!overviewRes.ok) throw new Error(overviewData.error || "Failed to load overview.");
      if (!requestsRes.ok) throw new Error(requestsData.error || "Failed to load requests.");
      setOverview(overviewData);
      setRequests(requestsData.requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCourse(e) {
    e.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/teacher/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, description, price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create course.");
      setTitle("");
      setDescription("");
      setPrice("");
      setShowForm(false);
      fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRespond(enrollmentId, action) {
    setRespondingId(enrollmentId);
    try {
      const res = await fetch(`${API_BASE}/teacher/enrollment-requests/${enrollmentId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to respond.");
      fetchAll(); // refresh both requests list and real overview numbers
    } catch (err) {
      setError(err.message);
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div>
          <h1 className="text-lg font-semibold">Teacher Dashboard</h1>
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

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <>
            {/* Real stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <BookOpen size={14} /> Total Courses
                </div>
                <p className="text-2xl font-semibold">{overview?.totalCourses ?? 0}</p>
              </div>
              <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <Users size={14} /> Total Students
                </div>
                <p className="text-2xl font-semibold">{overview?.totalStudents ?? 0}</p>
              </div>
              <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <IndianRupee size={14} /> Total Earnings
                </div>
                <p className="text-2xl font-semibold">₹{(overview?.totalEarnings ?? 0).toLocaleString("en-IN")}</p>
              </div>
              <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <Clock3 size={14} /> Pending Requests
                </div>
                <p className="text-2xl font-semibold text-yellow-400">{overview?.pendingRequestCount ?? 0}</p>
              </div>
            </div>

            {/* Enrollment Requests — the approval queue */}
            <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5 mb-6">
              <h2 className="text-sm font-semibold mb-4">Enrollment Requests</h2>

              {requests.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  No pending requests right now.
                </p>
              ) : (
                <div className="space-y-3">
                  {requests.map((r) => (
                    <div
                      key={r.enrollmentId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 rounded-xl p-3"
                    >
                      <div>
                        <p className="font-medium text-sm">{r.studentName}</p>
                        <p className="text-xs text-gray-500">{r.studentEmail}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Wants: <span className="text-purple-300">{r.courseTitle}</span> · ₹{r.coursePrice}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                          <Phone size={11} /> {r.contactNumber}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRespond(r.enrollmentId, "approve")}
                          disabled={respondingId === r.enrollmentId}
                          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 transition text-white text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                        >
                          <Check size={13} /> Approve
                        </button>
                        <button
                          onClick={() => handleRespond(r.enrollmentId, "reject")}
                          disabled={respondingId === r.enrollmentId}
                          className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 transition text-red-300 text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                        >
                          <XIcon size={13} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Courses */}
            <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">My Courses</h2>
                <button
                  onClick={() => setShowForm((s) => !s)}
                  className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 transition text-white px-3 py-1.5 rounded-lg"
                >
                  <Plus size={13} /> New Course
                </button>
              </div>

              {showForm && (
                <form onSubmit={handleCreateCourse} className="bg-white/5 rounded-xl p-4 mb-4 flex flex-col gap-3">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Course title"
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description (optional)"
                    rows={2}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500 resize-none"
                  />
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Price in ₹ (0 for free)"
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={creating}
                    className="bg-purple-600 hover:bg-purple-700 transition text-white py-2 rounded-lg text-sm disabled:opacity-60"
                  >
                    {creating ? "Creating..." : "Create Course"}
                  </button>
                </form>
              )}

              {(!overview?.courses || overview.courses.length === 0) ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  No courses yet — create your first one above.
                </p>
              ) : (
                <div className="space-y-3">
                  {overview.courses.map((c) => (
                    <div key={c.id} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                      <div>
                        <p className="font-medium text-sm">{c.title}</p>
                        <p className="text-xs text-gray-500">
                          ₹{c.price} · {c.studentsEnrolled} students
                          {c.pendingRequests > 0 && (
                            <span className="text-yellow-400"> · {c.pendingRequests} pending</span>
                          )}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-green-400">₹{c.earnings.toLocaleString("en-IN")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}