import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import Sidebar from "./Sidebar";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const ALLOWED_STATUSES = new Set(["ACTIVE", "TRIALING", "GRACE"]);

export default function PremiumGate({ children, featureName = "this feature" }) {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    let alive = true;
    async function loadSubscription() {
      try {
        const res = await fetch(`${API_BASE}/subscription/me`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (alive) setSubscription(data.subscription || null);
      } catch {
        if (alive) setSubscription(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadSubscription();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin text-purple-400" />
            Checking access...
          </div>
        </main>
      </div>
    );
  }

  if (!ALLOWED_STATUSES.has(subscription?.status)) {
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <section className="w-full max-w-xl rounded-2xl border border-purple-500/30 bg-[#171724] p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600/20 text-purple-300">
              <LockKeyhole size={26} />
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-300">
              Premium access
            </p>
            <h1 className="text-2xl font-bold text-white">Unlock {featureName}</h1>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              Start the 30-day free trial or activate a plan to use FocusForge AI premium tools.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/subscription"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                <Sparkles size={16} />
                Start trial
              </Link>
              <Link
                to="/subscription"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/5"
              >
                <Crown size={16} />
                View plans
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return children;
}
