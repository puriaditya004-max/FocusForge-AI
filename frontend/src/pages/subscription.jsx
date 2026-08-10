import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import {
  BadgeIndianRupee,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Crown,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const PLAY_STORE_BUILD = import.meta.env.VITE_PLAY_STORE_BUILD === "true";

const PLAN_COPY = {
  STUDENT_MONTHLY: {
    label: "Student Monthly",
    price: "Rs 199",
    cadence: "per month",
    features: ["Full AI timetable access", "Today's Plan + Focus Mode", "AI mentor and rewards"],
  },
  STUDENT_YEARLY: {
    label: "Student Yearly",
    price: "Rs 1,499",
    cadence: "per year",
    features: ["Best value for exam season", "Everything in monthly", "Lower renewal friction"],
  },
  FAMILY: {
    label: "Family Plan",
    price: "Rs 299",
    cadence: "per month",
    features: ["Up to 3 student profiles", "Parent panel ready", "Weekly progress digest hooks"],
  },
};

function formatDate(value) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function loadRazorpayCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout. Please check your connection."));
    document.body.appendChild(script);
  });
}

export default function Subscription() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [workingPlan, setWorkingPlan] = useState("");
  const [startingTrial, setStartingTrial] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  async function fetchSubscription() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/subscription/me`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load subscription.");
      setSubscription(data.subscription);
      setPlans(data.plans || {});
    } catch (err) {
      setError(err.message || "Failed to load subscription.");
    } finally {
      setLoading(false);
    }
  }

  async function startTrial() {
    setStartingTrial(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/subscription/trial`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start trial.");
      setSubscription(data.subscription);
      setMessage("Your 30-day free trial is active.");
    } catch (err) {
      setError(err.message || "Failed to start trial.");
    } finally {
      setStartingTrial(false);
    }
  }

  async function activatePlan(planId) {
    if (PLAY_STORE_BUILD) {
      setError("Play Store builds need Google Play Billing or India Alternative Billing enrollment before Razorpay checkout.");
      return;
    }

    setWorkingPlan(planId);
    setError("");
    setMessage("");
    try {
      await loadRazorpayCheckout();
      const orderRes = await fetch(`${API_BASE}/subscription/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: planId }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to start subscription payment.");

      await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: orderData.keyId,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: "FocusForge AI",
          description: orderData.plan.label,
          order_id: orderData.order.id,
          prefill: {
            name: user?.name || "",
            email: user?.email || "",
            contact: user?.mobileNumber || "",
          },
          notes: { plan: planId },
          theme: { color: "#7c3aed" },
          handler: async function (response) {
            try {
              const verifyRes = await fetch(`${API_BASE}/subscription/verify`, {
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

      await fetchSubscription();
      setMessage("Subscription activated successfully.");
    } catch (err) {
      setError(err.message || "Failed to activate subscription.");
    } finally {
      setWorkingPlan("");
    }
  }

  const status = subscription?.status || "NONE";
  const statusClass =
    status === "ACTIVE"
      ? "bg-green-500/10 text-green-300 border-green-500/20"
      : status === "TRIALING"
        ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
        : status === "GRACE"
          ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
          : "bg-red-500/10 text-red-300 border-red-500/20";

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <TopBar userName={user?.name || "Student"} streak={user?.currentStreak ?? 0} level={user?.level ?? 1} />

        <div className="px-4 md:px-6 mt-4 mb-8">
          <div className="mb-5">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Crown className="text-purple-400" size={22} />
              Subscription
            </h1>
            <p className="text-sm text-gray-400 mt-1">Manage your FocusForge trial and paid access.</p>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading subscription...</p>
          ) : (
            <div className="grid gap-5">
              <section className="bg-[#13131f] border border-white/5 rounded-2xl p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Current Access</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 border px-3 py-1.5 rounded-full text-xs font-semibold ${statusClass}`}>
                        <CheckCircle2 size={14} /> {status}
                      </span>
                      <span className="text-sm text-gray-300">{subscription?.plan || "No plan yet"}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Access ends: <span className="text-gray-300">{formatDate(subscription?.accessEndsAt)}</span>
                    </p>
                  </div>

                  {subscription?.trialAvailable && (
                    <button
                      onClick={startTrial}
                      disabled={startingTrial}
                      className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm disabled:opacity-60"
                    >
                      {startingTrial ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                      Start 30-day Trial
                    </button>
                  )}
                </div>
              </section>

              {PLAY_STORE_BUILD && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 rounded-2xl p-4 text-sm flex gap-3">
                  <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
                  <p>
                    Razorpay checkout is disabled in Play Store builds until Google Play Billing or India Alternative Billing enrollment is complete.
                  </p>
                </div>
              )}

              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-3 text-sm">{error}</div>}
              {message && <div className="bg-green-500/10 border border-green-500/20 text-green-300 rounded-xl p-3 text-sm">{message}</div>}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {Object.entries(PLAN_COPY).map(([planId, copy]) => {
                  const serverPlan = plans[planId] || {};
                  return (
                    <section key={planId} className="bg-[#13131f] border border-white/5 rounded-2xl p-5 flex flex-col">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <h2 className="font-semibold">{copy.label}</h2>
                          <p className="text-xs text-gray-500">{copy.cadence}</p>
                        </div>
                        <BadgeIndianRupee className="text-purple-300" size={22} />
                      </div>
                      <p className="text-2xl font-bold mb-1">{copy.price}</p>
                      <p className="text-xs text-gray-500 mb-4">
                        Server amount: {((serverPlan.amountPaise || 0) / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
                      </p>
                      <ul className="space-y-2 mb-5 flex-1">
                        {copy.features.map((feature) => (
                          <li key={feature} className="text-sm text-gray-300 flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-green-400" /> {feature}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => activatePlan(planId)}
                        disabled={Boolean(workingPlan) || PLAY_STORE_BUILD}
                        className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-xl text-sm"
                      >
                        {workingPlan === planId ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                        Activate
                      </button>
                    </section>
                  );
                })}
              </div>

              <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <CalendarDays size={16} className="text-purple-300" /> Play Store compliance note
                </h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Web checkout can use Razorpay. Play Store Android builds must use Google Play Billing or the India Alternative Billing program before showing Razorpay inside the app.
                </p>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
