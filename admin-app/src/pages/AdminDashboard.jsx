import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Users,
  GraduationCap,
  ShieldCheck,
  IndianRupee,
  Undo2,
  BookOpen,
  LogOut,
  Check,
  X as XIcon,
  FileText,
  Clock3,
  RefreshCcw,
  Flag,
  Trash2,
  Contact,
  Ban,
  Wallet,
  RotateCw,
  BadgeCheck,
  ReceiptText,
} from "lucide-react";

// ---------------------------------------------------------
// Admin Dashboard — the missing UI for the ADMIN-only backend
// routes that already existed (teacher verification review,
// refund processing) but previously had no click-to-review page.
//
// Three tabs:
//   Overview            → platform-wide counts (GET /admin/overview)
//   Teacher Verifications → approve/reject queue (GET/POST /admin/teacher-verifications)
//   Refunds              → approve/reject queue (GET/POST /admin/refunds)
//
// Same "no fake data" rule as every other dashboard in this app:
// every number here comes straight from the backend.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const FILE_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "verifications", label: "Teacher Verifications" },
  { id: "refunds", label: "Refunds" },
  { id: "reports", label: "Study Room Reports" },
  { id: "digital-ids", label: "Digital IDs" },
  { id: "payouts", label: "Teacher Payouts" },
];

function formatMoney(paise) {
  return `₹${((paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ value }) {
  const tone =
    value === "PAID" || value === "ACTIVE" || value === "APPROVED"
      ? "bg-green-500/15 text-green-300 border-green-500/20"
      : value === "PENDING" || value === "CREATED" || value === "REQUESTED"
        ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/20"
        : "bg-red-500/15 text-red-300 border-red-500/20";
  return <span className={`text-[10px] px-2 py-1 rounded-full border ${tone}`}>{value}</span>;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("overview");

  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [verifications, setVerifications] = useState([]);
  const [verificationsLoading, setVerificationsLoading] = useState(false);
  const [verificationStatusFilter, setVerificationStatusFilter] = useState("PENDING");

  const [refunds, setRefunds] = useState([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundStatusFilter, setRefundStatusFilter] = useState("REQUESTED");

  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState("PENDING");

  const [digitalIds, setDigitalIds] = useState([]);
  const [digitalIdsLoading, setDigitalIdsLoading] = useState(false);
  const [digitalIdStatusFilter, setDigitalIdStatusFilter] = useState("ACTIVE");

  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("ALL");

  const [actingId, setActingId] = useState(null);
  const [notesDraft, setNotesDraft] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (tab === "verifications") fetchVerifications(verificationStatusFilter);
    if (tab === "refunds") fetchRefunds(refundStatusFilter);
    if (tab === "reports") fetchReports(reportStatusFilter);
    if (tab === "digital-ids") fetchDigitalIds(digitalIdStatusFilter);
    if (tab === "payouts") fetchPayouts(payoutStatusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, verificationStatusFilter, refundStatusFilter, reportStatusFilter, digitalIdStatusFilter, payoutStatusFilter]);

  async function fetchOverview() {
    try {
      setOverviewLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/admin/overview`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load overview.");
      setOverview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setOverviewLoading(false);
    }
  }

  async function fetchVerifications(status) {
    try {
      setVerificationsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/admin/teacher-verifications?status=${status}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load verification queue.");
      setVerifications(data.verifications || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerificationsLoading(false);
    }
  }

  async function fetchRefunds(status) {
    try {
      setRefundsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/admin/refunds?status=${status}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load refund queue.");
      setRefunds(data.refunds || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefundsLoading(false);
    }
  }

  async function fetchReports(status) {
    try {
      setReportsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/admin/studyroom-reports?status=${status}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load report queue.");
      setReports(data.reports || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setReportsLoading(false);
    }
  }

  async function fetchDigitalIds(status) {
    try {
      setDigitalIdsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/admin/digital-ids?status=${status}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load Digital IDs.");
      setDigitalIds(data.cards || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setDigitalIdsLoading(false);
    }
  }

  async function handleRevokeDigitalId(id) {
    if (!window.confirm("Revoke this Digital ID? The student will need an admin to re-issue one.")) return;
    setActingId(id);
    try {
      const res = await fetch(`${API_BASE}/admin/digital-ids/${id}/revoke`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke Digital ID.");
      fetchDigitalIds(digitalIdStatusFilter);
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  }

  async function fetchPayouts(status) {
    try {
      setPayoutsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/admin/payouts?status=${status}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payouts.");
      setPayouts(data.payments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setPayoutsLoading(false);
    }
  }

  async function handleRetryPayout(paymentId) {
    setActingId(paymentId);
    try {
      const res = await fetch(`${API_BASE}/admin/payments/${paymentId}/retry-payout`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to retry payout.");
      fetchPayouts(payoutStatusFilter);
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  }

  async function handleReportAction(id, action) {
    setActingId(id);
    try {
      const res = await fetch(`${API_BASE}/admin/studyroom-reports/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve report.");
      fetchReports(reportStatusFilter);
      fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  }

  async function handleVerificationReview(id, action) {
    setActingId(id);
    try {
      const res = await fetch(`${API_BASE}/admin/teacher-verifications/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, reviewerNotes: notesDraft[id] || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to review verification.");
      fetchVerifications(verificationStatusFilter);
      fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  }

  async function handleRefundAction(refundId, action) {
    setActingId(refundId);
    try {
      const res = await fetch(`${API_BASE}/admin/refunds/${refundId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, notes: notesDraft[refundId] || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process refund.");
      fetchRefunds(refundStatusFilter);
      fetchOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  }

  const statusFilterOptions = ["PENDING", "APPROVED", "REJECTED", "ALL"];
  const refundFilterOptions = ["REQUESTED", "PROCESSED", "REJECTED", "ALL"];

  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck size={18} className="text-purple-300" /> Admin Panel
          </h1>
          <p className="text-xs text-gray-500">Signed in as {user?.name} ({user?.email})</p>
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
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl p-3 mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-300/70 hover:text-red-200">
              <XIcon size={14} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-sm px-4 py-2 border-b-2 transition ${
                tab === t.id
                  ? "border-purple-500 text-purple-300"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
              {t.id === "verifications" && overview?.pendingTeacherVerifications > 0 && (
                <span className="ml-2 bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded-full">
                  {overview.pendingTeacherVerifications}
                </span>
              )}
              {t.id === "refunds" && overview?.pendingRefunds > 0 && (
                <span className="ml-2 bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded-full">
                  {overview.pendingRefunds}
                </span>
              )}
              {t.id === "reports" && overview?.pendingStudyRoomReports > 0 && (
                <span className="ml-2 bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded-full">
                  {overview.pendingStudyRoomReports}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ---------------- Overview tab ---------------- */}
        {tab === "overview" && (
          overviewLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard icon={Users} label="Total Users" value={overview?.users.total ?? 0} />
                <StatCard icon={GraduationCap} label="Students" value={overview?.users.byRole.STUDENT ?? 0} />
                <StatCard icon={Users} label="Parents" value={overview?.users.byRole.PARENT ?? 0} />
                <StatCard icon={BookOpen} label="Teachers" value={overview?.users.byRole.TEACHER ?? 0} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={Clock3}
                  label="Pending Teacher Verifications"
                  value={overview?.pendingTeacherVerifications ?? 0}
                  tone={overview?.pendingTeacherVerifications > 0 ? "text-yellow-400" : "text-gray-100"}
                />
                <StatCard
                  icon={Undo2}
                  label="Pending Refunds"
                  value={overview?.pendingRefunds ?? 0}
                  tone={overview?.pendingRefunds > 0 ? "text-yellow-400" : "text-gray-100"}
                />
                <StatCard
                  icon={Flag}
                  label="Pending Study Room Reports"
                  value={overview?.pendingStudyRoomReports ?? 0}
                  tone={overview?.pendingStudyRoomReports > 0 ? "text-yellow-400" : "text-gray-100"}
                />
                <StatCard icon={BadgeCheck} label="Active Digital IDs" value={overview?.activeDigitalIds ?? 0} tone="text-green-300" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
                <StatCard icon={IndianRupee} label="Gross Revenue" value={formatMoney(overview?.totalRevenuePaise)} tone="text-green-400" />
                <StatCard icon={Undo2} label="Refunded" value={formatMoney(overview?.totalRefundedPaise)} tone="text-red-300" />
                <StatCard icon={IndianRupee} label="Net Revenue" value={formatMoney(overview?.netRevenuePaise)} tone="text-purple-300" />
                <StatCard icon={ReceiptText} label="Paid Payments" value={overview?.paidPaymentCount ?? 0} />
                <StatCard icon={BookOpen} label="Total Courses" value={overview?.totalCourses ?? 0} />
                <StatCard icon={Users} label="Active Enrollments" value={overview?.totalEnrollments ?? 0} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
                <section className="bg-[#13131f] rounded-xl border border-white/5 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Recent Users</h2>
                    <span className="text-[10px] text-gray-500">latest 8</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {(overview?.recentUsers || []).length === 0 ? (
                      <p className="text-sm text-gray-500 p-4">No users yet.</p>
                    ) : (
                      overview.recentUsers.map((u) => (
                        <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-100 truncate">{u.name}</p>
                            <p className="text-xs text-gray-500 truncate">{u.email}</p>
                            <p className="text-[10px] text-gray-600 mt-0.5">{formatDateTime(u.createdAt)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <StatusPill value={u.role} />
                            <span className={`text-[10px] ${u.emailVerifiedAt || u.mobileVerifiedAt ? "text-green-400" : "text-yellow-400"}`}>
                              {u.emailVerifiedAt || u.mobileVerifiedAt ? "verified" : "unverified"}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="bg-[#13131f] rounded-xl border border-white/5 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Recent Payments</h2>
                    <span className="text-[10px] text-gray-500">latest 8</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {(overview?.recentPayments || []).length === 0 ? (
                      <p className="text-sm text-gray-500 p-4">No payments yet.</p>
                    ) : (
                      overview.recentPayments.map((p) => (
                        <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-100 truncate">{p.courseTitle}</p>
                            <p className="text-xs text-gray-500 truncate">{p.studentName} · {p.studentEmail}</p>
                            <p className="text-[10px] text-gray-600 mt-0.5">{formatDateTime(p.paidAt || p.createdAt)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <p className="text-sm font-semibold text-green-400">{formatMoney(p.amountPaise)}</p>
                            <StatusPill value={p.status} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </>
          )
        )}

        {/* ---------------- Teacher Verifications tab ---------------- */}
        {tab === "verifications" && (
          <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Teacher Verification Queue</h2>
              <div className="flex items-center gap-2">
                <select
                  value={verificationStatusFilter}
                  onChange={(e) => setVerificationStatusFilter(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-purple-500"
                >
                  {statusFilterOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={() => fetchVerifications(verificationStatusFilter)}
                  className="text-gray-400 hover:text-gray-200 p-1.5 rounded-lg hover:bg-white/5"
                  title="Refresh"
                >
                  <RefreshCcw size={14} />
                </button>
              </div>
            </div>

            {verificationsLoading ? (
              <p className="text-sm text-gray-500 text-center py-6">Loading...</p>
            ) : verifications.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No {verificationStatusFilter.toLowerCase()} verification requests.</p>
            ) : (
              <div className="space-y-3">
                {verifications.map((v) => (
                  <div key={v.id} className="bg-white/5 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{v.fullName}</p>
                        <p className="text-xs text-gray-500">{v.teacher?.name} · {v.teacher?.email}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {v.institute && <>Institute: <span className="text-gray-300">{v.institute}</span> · </>}
                          {v.qualification && <>Qualification: <span className="text-gray-300">{v.qualification}</span> · </>}
                          {v.experienceYears != null && <>{v.experienceYears} yrs experience</>}
                        </p>
                        {v.notes && <p className="text-xs text-gray-500 mt-1">Note: {v.notes}</p>}
                        <div className="flex gap-3 mt-2">
                          <a
                            href={`${FILE_ORIGIN}${v.idDocumentUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200"
                          >
                            <FileText size={12} /> ID Document
                          </a>
                          {v.educationDocumentUrl && (
                            <a
                              href={`${FILE_ORIGIN}${v.educationDocumentUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200"
                            >
                              <FileText size={12} /> Education Document
                            </a>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap ${
                          v.status === "PENDING"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : v.status === "APPROVED"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>

                    {v.status === "PENDING" && (
                      <div className="flex flex-col sm:flex-row gap-2 mt-3">
                        <input
                          value={notesDraft[v.id] || ""}
                          onChange={(e) => setNotesDraft((p) => ({ ...p, [v.id]: e.target.value }))}
                          placeholder="Reviewer notes (optional)"
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleVerificationReview(v.id, "approve")}
                            disabled={actingId === v.id}
                            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 transition text-white text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            onClick={() => handleVerificationReview(v.id, "reject")}
                            disabled={actingId === v.id}
                            className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 transition text-red-300 text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                          >
                            <XIcon size={13} /> Reject
                          </button>
                        </div>
                      </div>
                    )}
                    {v.reviewerNotes && v.status !== "PENDING" && (
                      <p className="text-xs text-gray-500 mt-2">Reviewer notes: {v.reviewerNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- Refunds tab ---------------- */}
        {tab === "refunds" && (
          <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Refund Queue</h2>
              <div className="flex items-center gap-2">
                <select
                  value={refundStatusFilter}
                  onChange={(e) => setRefundStatusFilter(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-purple-500"
                >
                  {refundFilterOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={() => fetchRefunds(refundStatusFilter)}
                  className="text-gray-400 hover:text-gray-200 p-1.5 rounded-lg hover:bg-white/5"
                  title="Refresh"
                >
                  <RefreshCcw size={14} />
                </button>
              </div>
            </div>

            {refundsLoading ? (
              <p className="text-sm text-gray-500 text-center py-6">Loading...</p>
            ) : refunds.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No {refundStatusFilter.toLowerCase()} refund requests.</p>
            ) : (
              <div className="space-y-3">
                {refunds.map((r) => (
                  <div key={r.id} className="bg-white/5 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{r.requestedBy?.name}</p>
                        <p className="text-xs text-gray-500">{r.requestedBy?.email}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Course: <span className="text-purple-300">{r.payment?.course?.title}</span>
                        </p>
                        <p className="text-sm font-semibold text-green-400 mt-1">{formatMoney(r.amountPaise)}</p>
                        {r.reason && <p className="text-xs text-gray-500 mt-1">Reason: {r.reason}</p>}
                      </div>

                      <span
                        className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap ${
                          r.status === "REQUESTED"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : r.status === "PROCESSED"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    {r.status === "REQUESTED" && (
                      <div className="flex flex-col sm:flex-row gap-2 mt-3">
                        <input
                          value={notesDraft[r.id] || ""}
                          onChange={(e) => setNotesDraft((p) => ({ ...p, [r.id]: e.target.value }))}
                          placeholder="Notes (optional, used if rejecting)"
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-purple-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRefundAction(r.id, "approve")}
                            disabled={actingId === r.id}
                            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 transition text-white text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                          >
                            <Check size={13} /> {actingId === r.id ? "Processing..." : "Approve & Refund"}
                          </button>
                          <button
                            onClick={() => handleRefundAction(r.id, "reject")}
                            disabled={actingId === r.id}
                            className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 transition text-red-300 text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                          >
                            <XIcon size={13} /> Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- Study Room Reports tab ---------------- */}
        {tab === "reports" && (
          <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Study Room Report Queue</h2>
              <div className="flex items-center gap-2">
                <select
                  value={reportStatusFilter}
                  onChange={(e) => setReportStatusFilter(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-purple-500"
                >
                  {["PENDING", "MESSAGE_DELETED", "DISMISSED", "ALL"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={() => fetchReports(reportStatusFilter)}
                  className="text-gray-400 hover:text-gray-200 p-1.5 rounded-lg hover:bg-white/5"
                  title="Refresh"
                >
                  <RefreshCcw size={14} />
                </button>
              </div>
            </div>

            {reportsLoading ? (
              <p className="text-sm text-gray-500 text-center py-6">Loading...</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No {reportStatusFilter.toLowerCase().replace("_", " ")} reports.</p>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <div key={r.id} className="bg-white/5 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          Room: <span className="text-purple-300">{r.message?.room?.name}</span>
                        </p>
                        <p className="text-sm mt-1 bg-black/30 rounded-lg px-3 py-2">
                          <span className="text-gray-500">{r.message?.user?.name}: </span>
                          <span className={r.message?.isDeleted ? "line-through text-gray-600" : "text-gray-200"}>
                            {r.message?.message}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Reported by {r.reportedBy?.name} ({r.reportedBy?.email})
                          {r.reason && <> — "{r.reason}"</>}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap ${
                          r.status === "PENDING"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : r.status === "MESSAGE_DELETED"
                            ? "bg-red-500/20 text-red-300"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {r.status.replace("_", " ")}
                      </span>
                    </div>

                    {r.status === "PENDING" && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleReportAction(r.id, "delete")}
                          disabled={actingId === r.id}
                          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 transition text-white text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                        >
                          <Trash2 size={13} /> Delete Message
                        </button>
                        <button
                          onClick={() => handleReportAction(r.id, "dismiss")}
                          disabled={actingId === r.id}
                          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition text-gray-300 text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                        >
                          <XIcon size={13} /> Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- Digital IDs tab ---------------- */}
        {tab === "digital-ids" && (
          <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Issued Digital IDs</h2>
              <div className="flex items-center gap-2">
                <select
                  value={digitalIdStatusFilter}
                  onChange={(e) => setDigitalIdStatusFilter(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-purple-500"
                >
                  {["ACTIVE", "REVOKED", "ALL"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={() => fetchDigitalIds(digitalIdStatusFilter)}
                  className="text-gray-400 hover:text-gray-200 p-1.5 rounded-lg hover:bg-white/5"
                  title="Refresh"
                >
                  <RefreshCcw size={14} />
                </button>
              </div>
            </div>

            {digitalIdsLoading ? (
              <p className="text-sm text-gray-500 text-center py-6">Loading...</p>
            ) : digitalIds.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No {digitalIdStatusFilter.toLowerCase()} Digital IDs.</p>
            ) : (
              <div className="space-y-3">
                {digitalIds.map((c) => (
                  <div key={c.id} className="bg-white/5 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        <Contact size={18} className="text-purple-300 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{c.holderName}</p>
                          <p className="text-xs text-gray-500">{c.holderEmail} · {c.holderRole}</p>
                          <p className="text-xs font-mono text-gray-400 mt-1">{c.cardNumber}</p>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Issued {new Date(c.issuedAt).toLocaleDateString("en-IN")}
                            {c.revokedAt && <> · Revoked {new Date(c.revokedAt).toLocaleDateString("en-IN")}</>}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap ${
                          c.status === "ACTIVE" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    {c.status === "ACTIVE" && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleRevokeDigitalId(c.id)}
                          disabled={actingId === c.id}
                          className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 transition text-red-300 text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                        >
                          <Ban size={13} /> {actingId === c.id ? "Revoking..." : "Revoke"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- Teacher Payouts tab ---------------- */}
        {tab === "payouts" && (
          <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Razorpay Route Payouts</h2>
              <div className="flex items-center gap-2">
                <select
                  value={payoutStatusFilter}
                  onChange={(e) => setPayoutStatusFilter(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-purple-500"
                >
                  {["ALL", "NOT_READY", "ROUTE_PENDING", "PAID_OUT", "FAILED"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={() => fetchPayouts(payoutStatusFilter)}
                  className="text-gray-400 hover:text-gray-200 p-1.5 rounded-lg hover:bg-white/5"
                  title="Refresh"
                >
                  <RefreshCcw size={14} />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Every PAID course payment and its Route transfer status. NOT_READY means the teacher hasn't linked a
              Razorpay Route account yet (Settings); FAILED can be retried once that's fixed.
            </p>

            {payoutsLoading ? (
              <p className="text-sm text-gray-500 text-center py-6">Loading...</p>
            ) : payouts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No payments in this status.</p>
            ) : (
              <div className="space-y-3">
                {payouts.map((p) => (
                  <div key={p.id} className="bg-white/5 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        <Wallet size={18} className="text-purple-300 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{p.course?.title}</p>
                          <p className="text-xs text-gray-500">
                            Teacher: {p.course?.teacher?.name}
                            {!p.course?.teacher?.razorpayRouteAccountId && (
                              <span className="text-yellow-400"> · no Route account linked</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">Student: {p.student?.name}</p>
                          <p className="text-sm font-semibold text-green-400 mt-1">
                            {formatMoney(p.teacherAmountPaise)} <span className="text-gray-500 font-normal">to teacher</span>
                          </p>
                          {p.payoutReference && (
                            <p className="text-[10px] font-mono text-gray-500 mt-1">Transfer: {p.payoutReference}</p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap ${
                          p.payoutStatus === "PAID_OUT"
                            ? "bg-green-500/20 text-green-400"
                            : p.payoutStatus === "FAILED"
                            ? "bg-red-500/20 text-red-300"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {p.payoutStatus}
                      </span>
                    </div>

                    {p.payoutStatus !== "PAID_OUT" && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleRetryPayout(p.id)}
                          disabled={actingId === p.id || !p.course?.teacher?.razorpayRouteAccountId}
                          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 transition text-white text-xs px-3 py-2 rounded-lg disabled:opacity-40"
                          title={!p.course?.teacher?.razorpayRouteAccountId ? "Teacher hasn't linked a Route account yet" : ""}
                        >
                          <RotateCw size={13} /> {actingId === p.id ? "Retrying..." : "Retry Payout"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
