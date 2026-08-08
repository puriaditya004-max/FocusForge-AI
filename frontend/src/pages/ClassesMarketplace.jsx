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
  CreditCard,
  PlayCircle,
  ReceiptText,
  RotateCcw,
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
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

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
  const [formMessage, setFormMessage] = useState("");
  const [payments, setPayments] = useState([]);
  const [activeVideoCourse, setActiveVideoCourse] = useState(null);
  const [courseVideos, setCourseVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);

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
      const [browseRes, mineRes, paymentsRes] = await Promise.all([
        fetch(`${API_BASE}/marketplace/courses`, { credentials: "include" }),
        fetch(`${API_BASE}/marketplace/my-courses`, { credentials: "include" }),
        fetch(`${API_BASE}/payments`, { credentials: "include" }),
      ]);
      const browseData = await browseRes.json();
      const mineData = await mineRes.json();
      const paymentsData = await paymentsRes.json();
      if (!browseRes.ok) throw new Error(browseData.error || "Failed to load courses.");
      if (!mineRes.ok) throw new Error(mineData.error || "Failed to load your courses.");
      if (!paymentsRes.ok) throw new Error(paymentsData.error || "Failed to load payments.");
      setCourses(browseData.courses || []);
      setMyCourses(mineData.courses || []);
      setPayments(paymentsData.payments || []);
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
    setFormMessage("");
  }

  function closeEnrollForm() {
    setActiveCourse(null);
  }

  function loadRazorpayCheckout() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error("Could not load Razorpay Checkout. Please check your connection."));
      document.body.appendChild(script);
    });
  }

  async function enrollFreeCourse() {
    const res = await fetch(`${API_BASE}/marketplace/courses/${activeCourse.id}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ contactNumber: formContact.trim() || "free-course" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to enroll.");
  }

  async function startPaidCheckout() {
    await loadRazorpayCheckout();

    const orderRes = await fetch(`${API_BASE}/payments/courses/${activeCourse.id}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ contactNumber: formContact.trim() || undefined }),
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) throw new Error(orderData.error || "Failed to start payment.");
    if (orderData.free) return;

    await new Promise((resolve, reject) => {
      const checkout = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "FocusForge AI",
        description: activeCourse.title,
        order_id: orderData.order.id,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: formContact.trim(),
        },
        notes: {
          courseId: activeCourse.id,
          enrollmentId: orderData.enrollmentId,
        },
        theme: { color: "#7c3aed" },
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${API_BASE}/payments/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed.");
            resolve(verifyData);
          } catch (err) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () => reject(new Error("Payment was cancelled before completion.")),
        },
      });

      checkout.on("payment.failed", (response) => {
        reject(new Error(response?.error?.description || "Payment failed. Please try again."));
      });

      checkout.open();
    });
  }

  async function submitEnrollment(e) {
    e.preventDefault();
    setFormError("");
    setFormMessage("");

    if (activeCourse.price > 0 && !formContact.trim()) {
      setFormError("Please enter a contact number for the payment receipt.");
      return;
    }

    setSubmitting(true);
    try {
      if (activeCourse.price > 0) {
        setFormMessage("Opening secure Razorpay Checkout...");
        await startPaidCheckout();
      } else {
        await enrollFreeCourse();
      }
      closeEnrollForm();
      await fetchAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function openCoursePlayer(course) {
    setActiveVideoCourse(course);
    setCourseVideos([]);
    setSelectedVideo(null);
    const res = await fetch(`${API_BASE}/marketplace/courses/${course.courseId}/videos`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load course videos.");
      return;
    }
    setCourseVideos(data.videos || []);
    setSelectedVideo(data.videos?.[0] || null);
  }

  async function requestRefund(paymentId) {
    const reason = window.prompt("Refund reason");
    if (reason === null) return;
    try {
      const res = await fetch(`${API_BASE}/payments/${paymentId}/refund-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request refund.");
      fetchAll();
    } catch (err) {
      setError(err.message);
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
            <button
              onClick={() => setTab("payments")}
              className={`text-sm px-4 py-2 rounded-lg transition ${
                tab === "payments" ? "bg-purple-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              Payments ({payments.length})
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
                          className="bg-purple-600 hover:bg-purple-700 transition text-white py-2 rounded-lg text-sm flex items-center justify-center gap-1.5"
                        >
                          {c.price > 0 ? <CreditCard size={14} /> : <CheckCircle2 size={14} />}
                          {c.price > 0 ? "Pay & Enroll" : "Enroll Free"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : tab === "mine" ? myCourses.length === 0 ? (
            <div className="bg-[#13131f] rounded-2xl p-8 border border-white/5 text-center">
              <p className="font-semibold mb-1">You haven't requested any course yet</p>
              <p className="text-sm text-gray-400">Switch to "Browse All" to find one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myCourses.map((c) => {
                const statusCfg = STATUS_CONFIG[c.status];
                return (
                  <div key={c.enrollmentId} className="bg-[#13131f] rounded-2xl p-4 border border-white/5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-700/30 flex items-center justify-center">
                        <BookOpen size={16} className="text-purple-300" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{c.title}</p>
                        <p className="text-xs text-gray-500">by {c.teacherName} · {c.videoCount || 0} videos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status === "APPROVED" && c.videoCount > 0 && (
                        <button
                          onClick={() => openCoursePlayer(c)}
                          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 transition px-3 py-1.5 rounded-lg text-xs text-white"
                        >
                          <PlayCircle size={13} /> Watch
                        </button>
                      )}
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${statusCfg.className}`}>
                        <statusCfg.icon size={13} /> {statusCfg.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {payments.length === 0 ? (
                <div className="bg-[#13131f] rounded-2xl p-8 border border-white/5 text-center">
                  <p className="font-semibold mb-1">No payments yet</p>
                  <p className="text-sm text-gray-400">Paid course receipts will show here.</p>
                </div>
              ) : payments.map((p) => (
                <div key={p.id} className="bg-[#13131f] rounded-2xl p-4 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{p.course?.title}</p>
                    <p className="text-xs text-gray-500">
                      {(p.amountPaise / 100).toLocaleString("en-IN", { style: "currency", currency: p.currency || "INR" })} · {p.status}
                    </p>
                    {p.invoice && (
                      <p className="text-xs text-purple-300 flex items-center gap-1 mt-1">
                        <ReceiptText size={12} /> Invoice {p.invoice.invoiceNumber}
                      </p>
                    )}
                  </div>
                  {p.status === "PAID" && (
                    <button
                      onClick={() => requestRefund(p.id)}
                      className="flex items-center justify-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 transition text-red-300 text-xs px-3 py-2 rounded-lg"
                    >
                      <RotateCcw size={13} /> Request Refund
                    </button>
                  )}
                </div>
              ))}
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

            <h2 className="font-semibold mb-1">{activeCourse.price > 0 ? "Pay & Enroll" : "Enroll Free"}</h2>
            <p className="text-xs text-gray-500 mb-4">
              for <span className="text-purple-300">{activeCourse.title}</span> · ₹{activeCourse.price}
            </p>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg p-2 mb-3">
                {formError}
              </div>
            )}
            {formMessage && (
              <div className="bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs rounded-lg p-2 mb-3">
                {formMessage}
              </div>
            )}
            {activeCourse.price > 0 && user?.isMinor && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs rounded-lg p-2 mb-3">
                This is a minor account. A parent must link and approve this account (Parent
                Dashboard → link request) before a paid enrollment can go through.
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
                <label className="text-[11px] text-gray-500 mb-1 block">
                  Contact number {activeCourse.price > 0 ? "*" : "(optional)"}
                </label>
                <input
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  placeholder={activeCourse.price > 0 ? "Used in Razorpay Checkout" : "Optional"}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                />
              </div>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                {activeCourse.price > 0
                  ? "Payment is verified on the server before your enrollment is approved."
                  : "Free courses are added to your account immediately."}
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="bg-purple-600 hover:bg-purple-700 transition text-white py-2.5 rounded-lg text-sm disabled:opacity-60 mt-1"
              >
                {submitting ? "Processing..." : activeCourse.price > 0 ? "Continue to Payment" : "Enroll Now"}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeVideoCourse && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
          <div className="bg-[#13131f] border border-white/10 rounded-2xl w-full max-w-4xl p-5 relative">
            <button
              onClick={() => setActiveVideoCourse(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-200"
            >
              <X size={18} />
            </button>
            <h2 className="font-semibold mb-4">{activeVideoCourse.title}</h2>
            {selectedVideo ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <video
                    key={selectedVideo.id}
                    controls
                    className="w-full aspect-video bg-black rounded-xl"
                    src={selectedVideo.videoUrl.startsWith("/uploads") ? `${API_ORIGIN}${selectedVideo.videoUrl}` : selectedVideo.videoUrl}
                  />
                  <p className="text-sm font-medium mt-3">{selectedVideo.title}</p>
                  {selectedVideo.description && <p className="text-xs text-gray-500 mt-1">{selectedVideo.description}</p>}
                </div>
                <div className="space-y-2">
                  {courseVideos.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVideo(v)}
                      className={`w-full text-left p-3 rounded-xl border text-sm ${
                        selectedVideo.id === v.id ? "bg-purple-600/20 border-purple-500/40" : "bg-white/5 border-white/10"
                      }`}
                    >
                      {v.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No videos have been added to this course yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
