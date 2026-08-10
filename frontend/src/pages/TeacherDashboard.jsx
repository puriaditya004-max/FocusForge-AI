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
  ShieldCheck,
  Upload,
  Video,
  Wallet,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function formatMoneyPaise(paise) {
  return `Rs ${((paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatMoneyRupees(amount) {
  return `Rs ${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function StatCard({ icon: Icon, label, value, tone = "text-gray-100" }) {
  return (
    <div className="bg-[#13131f] rounded-xl p-4 border border-white/5">
      <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
        <Icon size={14} /> {label}
      </div>
      <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

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
  const [verificationForm, setVerificationForm] = useState({
    fullName: "",
    institute: "",
    qualification: "",
    experienceYears: "",
    idDocument: null,
    educationDocument: null,
  });
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [videoForm, setVideoForm] = useState({ courseId: "", title: "", videoFile: null });
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  async function handleSubmitVerification(e) {
    e.preventDefault();
    if (!verificationForm.idDocument) {
      setError("ID document is required for teacher verification.");
      return;
    }
    setSubmittingVerification(true);
    try {
      const res = await fetch(`${API_BASE}/teacher/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName: verificationForm.fullName || user?.name || "",
          institute: verificationForm.institute,
          qualification: verificationForm.qualification,
          experienceYears: verificationForm.experienceYears || undefined,
          idDocumentDataUrl: await fileToDataUrl(verificationForm.idDocument),
          educationDocumentDataUrl: verificationForm.educationDocument
            ? await fileToDataUrl(verificationForm.educationDocument)
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit verification.");
      setVerificationForm((prev) => ({ ...prev, idDocument: null, educationDocument: null }));
      fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingVerification(false);
    }
  }

  async function handleUploadVideo(e) {
    e.preventDefault();
    if (!videoForm.courseId || !videoForm.title || !videoForm.videoFile) {
      setError("Select a course, lesson title, and video file.");
      return;
    }
    setUploadingVideo(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("title", videoForm.title);
      formData.append("video", videoForm.videoFile);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/teacher/courses/${videoForm.courseId}/videos/upload`);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        };
        xhr.onload = () => {
          let data = {};
          try {
            data = JSON.parse(xhr.responseText);
          } catch {
            // ignore non-JSON error body
          }
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || "Failed to upload video."));
        };
        xhr.onerror = () => reject(new Error("Network error while uploading video."));
        xhr.send(formData);
      });

      setVideoForm({ courseId: "", title: "", videoFile: null });
      fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingVideo(false);
      setUploadProgress(0);
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
      fetchAll();
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
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
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

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mb-6">
              <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
                      <ShieldCheck size={16} className="text-purple-300" /> Teacher Verification
                    </h2>
                    <p className="text-xs text-gray-500">
                      Status: <span className="text-purple-300">{overview?.verificationStatus || "NOT_SUBMITTED"}</span>
                      {overview?.teacherVerifiedAt && (
                        <> · Approved {new Date(overview.teacherVerifiedAt).toLocaleDateString("en-IN")}</>
                      )}
                    </p>
                    {overview?.verificationStatus === "REJECTED" && overview?.verificationReviewerNotes && (
                      <p className="text-xs text-red-300 mt-2">
                        Admin note: {overview.verificationReviewerNotes}
                      </p>
                    )}
                    {overview?.verificationStatus === "PENDING" && overview?.verificationSubmittedAt && (
                      <p className="text-xs text-yellow-300 mt-2">
                        Submitted {new Date(overview.verificationSubmittedAt).toLocaleDateString("en-IN")} · waiting for admin review.
                      </p>
                    )}
                  </div>
                </div>

                {overview?.verificationStatus !== "APPROVED" ? (
                  <form onSubmit={handleSubmitVerification} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={verificationForm.fullName}
                      onChange={(e) => setVerificationForm((p) => ({ ...p, fullName: e.target.value }))}
                      placeholder="Legal full name"
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                    />
                    <input
                      value={verificationForm.institute}
                      onChange={(e) => setVerificationForm((p) => ({ ...p, institute: e.target.value }))}
                      placeholder="Institute / organization"
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                    />
                    <input
                      value={verificationForm.qualification}
                      onChange={(e) => setVerificationForm((p) => ({ ...p, qualification: e.target.value }))}
                      placeholder="Qualification"
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                    />
                    <input
                      type="number"
                      value={verificationForm.experienceYears}
                      onChange={(e) => setVerificationForm((p) => ({ ...p, experienceYears: e.target.value }))}
                      placeholder="Experience years"
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                    />
                    <label className="text-xs text-gray-400">
                      ID document
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={(e) => setVerificationForm((p) => ({ ...p, idDocument: e.target.files?.[0] || null }))}
                        className="mt-1 block w-full text-xs"
                      />
                    </label>
                    <label className="text-xs text-gray-400">
                      Education document
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={(e) => setVerificationForm((p) => ({ ...p, educationDocument: e.target.files?.[0] || null }))}
                        className="mt-1 block w-full text-xs"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={submittingVerification}
                      className="md:col-span-2 bg-purple-600 hover:bg-purple-700 transition text-white py-2 rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <Upload size={14} /> {submittingVerification ? "Submitting..." : "Submit for Review"}
                    </button>
                  </form>
                ) : (
                  <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-200">
                    You are approved to publish courses in the marketplace.
                  </div>
                )}
              </div>

              <div
                className={`rounded-2xl p-4 border ${
                  overview?.razorpayRouteAccountId
                    ? "bg-green-500/10 border-green-500/20"
                    : "bg-yellow-500/10 border-yellow-500/20"
                }`}
              >
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  {overview?.razorpayRouteAccountId ? (
                    <Wallet size={16} className="text-green-300" />
                  ) : (
                    <AlertTriangle size={16} className="text-yellow-300" />
                  )}
                  Razorpay Route
                </h2>
                <p className="text-xs text-gray-400">
                  {overview?.razorpayRouteAccountId
                    ? "Route account linked. Teacher payouts can be transferred after payment capture."
                    : "Route account not linked. Payouts stay NOT_READY until this is added in Settings."}
                </p>
                {overview?.razorpayRouteAccountId && (
                  <p className="text-[10px] text-green-300 mt-2 font-mono break-all">{overview.razorpayRouteAccountId}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <StatCard icon={BookOpen} label="Total Courses" value={overview?.totalCourses ?? 0} />
              <StatCard icon={Users} label="Approved Students" value={overview?.totalStudents ?? 0} />
              <StatCard icon={Clock3} label="Pending Requests" value={overview?.pendingRequestCount ?? 0} tone="text-yellow-400" />
              <StatCard icon={Video} label="Paid Payments" value={overview?.paidPaymentCount ?? 0} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard icon={IndianRupee} label="Gross Revenue" value={formatMoneyPaise(overview?.grossRevenuePaise)} tone="text-green-400" />
              <StatCard icon={IndianRupee} label="Teacher Earnings" value={formatMoneyPaise(overview?.teacherEarningsPaise)} tone="text-purple-300" />
              <StatCard icon={Wallet} label="Paid Out" value={formatMoneyPaise(overview?.paidOutPaise)} tone="text-green-300" />
              <StatCard icon={Clock3} label="Pending Payout" value={formatMoneyPaise(overview?.pendingPayoutPaise)} tone="text-yellow-300" />
            </div>

            <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5 mb-6">
              <h2 className="text-sm font-semibold mb-4">Enrollment Requests</h2>

              {requests.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No pending requests right now.</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((r) => (
                    <div key={r.enrollmentId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 rounded-xl p-3">
                      <div>
                        <p className="font-medium text-sm">{r.studentName}</p>
                        <p className="text-xs text-gray-500">{r.studentEmail}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Wants: <span className="text-purple-300">{r.courseTitle}</span> · {formatMoneyRupees(r.coursePrice)}
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
                  {overview?.verificationStatus !== "APPROVED" && (
                    <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-xs px-3 py-2">
                      Courses can only be published after admin approves your teacher verification.
                    </div>
                  )}
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course title" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" rows={2} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500 resize-none" />
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price in Rs (0 for free)" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                  <button type="submit" disabled={creating || overview?.verificationStatus !== "APPROVED"} className="bg-purple-600 hover:bg-purple-700 transition text-white py-2 rounded-lg text-sm disabled:opacity-60">
                    {creating ? "Creating..." : overview?.verificationStatus === "APPROVED" ? "Create Course" : "Verification Required"}
                  </button>
                </form>
              )}

              {overview?.courses?.length > 0 && (
                <form onSubmit={handleUploadVideo} className="bg-white/5 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  {overview?.verificationStatus !== "APPROVED" && (
                    <div className="md:col-span-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-xs px-3 py-2">
                      Lesson uploads are locked until your teacher verification is approved.
                    </div>
                  )}
                  <select value={videoForm.courseId} onChange={(e) => setVideoForm((p) => ({ ...p, courseId: e.target.value }))} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500">
                    <option value="">Select course</option>
                    {overview.courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <input value={videoForm.title} onChange={(e) => setVideoForm((p) => ({ ...p, title: e.target.value }))} placeholder="Lesson title" className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                  <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setVideoForm((p) => ({ ...p, videoFile: e.target.files?.[0] || null }))} className="text-xs text-gray-400" />
                  <button type="submit" disabled={uploadingVideo || overview?.verificationStatus !== "APPROVED"} className="bg-purple-600 hover:bg-purple-700 transition text-white py-2 rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                    <Video size={14} /> {uploadingVideo ? `Uploading... ${uploadProgress}%` : overview?.verificationStatus === "APPROVED" ? "Add Video" : "Verification Required"}
                  </button>
                </form>
              )}

              {(!overview?.courses || overview.courses.length === 0) ? (
                <p className="text-sm text-gray-500 text-center py-6">No courses yet. Create your first one above.</p>
              ) : (
                <div className="space-y-3">
                  {overview.courses.map((c) => (
                    <div key={c.id} className="flex items-center justify-between bg-white/5 rounded-xl p-3 gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.title}</p>
                        <p className="text-xs text-gray-500">
                          {formatMoneyRupees(c.price)} · {c.studentsEnrolled} students · {c.videoCount} videos
                          {c.pendingRequests > 0 && <span className="text-yellow-400"> · {c.pendingRequests} pending</span>}
                          {c.previewVideoCount > 0 && <span className="text-purple-300"> · {c.previewVideoCount} preview</span>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-green-400">{formatMoneyPaise(c.teacherEarningsPaise)}</p>
                        <p className="text-[10px] text-gray-500">{c.paidPayments} paid payments</p>
                      </div>
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
