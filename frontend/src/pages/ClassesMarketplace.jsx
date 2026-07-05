import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import {
  Store,
  User2,
  IndianRupee,
  Users,
  CheckCircle2,
  Clock3,
  XCircle,
  BookOpen,
  X,
} from "lucide-react";

// ---------------------------------------------------------
// Classes Marketplace — with an approval-flow enrollment.
// "Enroll Now" opens a form (name + contact number) instead
// of instantly enrolling. This creates a PENDING request that
// the teacher must approve after confirming payment — so a
// course's real student/earnings count only grows once a
// human teacher has actually said yes.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const STATUS_CONFIG = {
  PENDING: { label: "Request Pending", icon: Clock3, className: "bg-yellow-500/10 text-yellow-400" },
  APPROVED: { label: "Enrolled", icon: CheckCircle2, className: "bg-green-500/10 text-green-400" },
  REJECTED: { label: "Request Rejected", icon: XCircle, className: "bg-red-500/10 text-red-400" },
};

export default function ClassesMarketplace() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("browse"); // "browse" | "mine"

  // Enrollment form modal state
  const [activeCourse, setActiveCourse] = useState(null); // course being enrolled into
  const [formName, setFormName] = useState("");
  const [formContact, setFormContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (user?.name) setFormName(user.name);
  }, [user]);

  async function fetchAll() {
    try {
      setLoading(true);
      setError(null);
      const [browseRes, mineRes] = await Promise.all([
        fetch(`${API_BASE}/marketplace/courses`, { credentials: "include" }),
        fetch(`${API_BASE}/marketplace/my-courses`, { credentials: "include" }),
      ]);
      const browseData = await browseRes.json();
      const mineData = await mineRes.json();
      if (!browseRes.ok) throw new Error(browseData.error || "Failed to load courses.");
      if (!mineRes.ok) throw new Error(mineData.error || "Failed to load your courses.");
      setCourses(browseData.courses || []);
      setMyCourses(mineData.courses || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openEnrollForm(course) {
    setActiveCourse(course);
    setFormContact("");
    setFormError("");
  }

  function closeEnrollForm() {
    setActiveCourse(null);
  }

  async function submitEnrollment(e) {
    e.preventDefault();
    setFormError("");

    if (!formContact.trim()) {
      setFormError("Please enter a contact number so the teacher can confirm payment with you.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/marketplace/courses/${activeCourse.id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contactNumber: formContact.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request.");
      closeEnrollForm();
      await fetchAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <TopBar userName={user?.name || "Student"} streak={user?.currentStreak ?? 0} level={user?.level ?? 1} />

        <div className="px-6 mt-4 mb-6">
          <div className="mb-4">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Store className="text-purple-400" size={20} />
              Classes Marketplace
            </h1>
            <p className="text-sm text-gray-400">Browse and enroll in real courses from real teachers.</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl p-3 mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTab("browse")}
              className={`text-sm px-4 py-2 rounded-lg transition ${
                tab === "browse" ? "bg-purple-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              Browse All ({courses.length})
            </button>
            <button
              onClick={() => setTab("mine")}
              className={`text-sm px-4 py-2 rounded-lg transition ${
                tab === "mine" ? "bg-purple-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              My Courses ({myCourses.length})
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : tab === "browse" ? (
            courses.length === 0 ? (
              <div className="bg-[#13131f] rounded-2xl p-8 border border-white/5 text-center">
                <p className="font-semibold mb-1">No courses available yet</p>
                <p className="text-sm text-gray-400">
                  Check back once teachers publish courses on the platform.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map((c) => {
                  const statusCfg = c.enrollmentStatus ? STATUS_CONFIG[c.enrollmentStatus] : null;
                  return (
                    <div key={c.id} className="bg-[#13131f] rounded-2xl p-5 border border-white/5 flex flex-col">
                      <h3 className="font-semibold mb-1">{c.title}</h3>
                      <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                        <User2 size={12} /> {c.teacherName}
                      </p>
                      {c.description && (
                        <p className="text-sm text-gray-400 mb-4 line-clamp-3">{c.description}</p>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500 mb-4 mt-auto">
                        <span className="flex items-center gap-1">
                          <IndianRupee size={12} /> {c.price === 0 ? "Free" : c.price}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {c.studentsEnrolled} enrolled
                        </span>
                      </div>

                      {statusCfg ? (
                        <div className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm ${statusCfg.className}`}>
                          <statusCfg.icon size={14} /> {statusCfg.label}
                        </div>
                      ) : (
                        <button
                          onClick={() => openEnrollForm(c)}
                          className="bg-purple-600 hover:bg-purple-700 transition text-white py-2 rounded-lg text-sm"
                        >
                          Enroll Now
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : myCourses.length === 0 ? (
            <div className="bg-[#13131f] rounded-2xl p-8 border border-white/5 text-center">
              <p className="font-semibold mb-1">You haven't requested any course yet</p>
              <p className="text-sm text-gray-400">Switch to "Browse All" to find one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myCourses.map((c) => {
                const statusCfg = STATUS_CONFIG[c.status];
                return (
                  <div key={c.enrollmentId} className="bg-[#13131f] rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-700/30 flex items-center justify-center">
                        <BookOpen size={16} className="text-purple-300" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{c.title}</p>
                        <p className="text-xs text-gray-500">by {c.teacherName}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${statusCfg.className}`}>
                      <statusCfg.icon size={13} /> {statusCfg.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Enrollment Request Modal */}
      {activeCourse && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#13131f] border border-white/10 rounded-2xl w-full max-w-sm p-5 relative">
            <button
              onClick={closeEnrollForm}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-200"
            >
              <X size={18} />
            </button>

            <h2 className="font-semibold mb-1">Request Enrollment</h2>
            <p className="text-xs text-gray-500 mb-4">
              for <span className="text-purple-300">{activeCourse.title}</span> · ₹{activeCourse.price}
            </p>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg p-2 mb-3">
                {formError}
              </div>
            )}

            <form onSubmit={submitEnrollment} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Your name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Course</label>
                <input
                  value={activeCourse.title}
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Your contact number *</label>
                <input
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  placeholder="For the teacher to confirm payment"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                />
              </div>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                After you submit, the teacher will reach out to confirm payment before approving your
                enrollment. Your course will show as "Pending" until then.
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="bg-purple-600 hover:bg-purple-700 transition text-white py-2.5 rounded-lg text-sm disabled:opacity-60 mt-1"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}