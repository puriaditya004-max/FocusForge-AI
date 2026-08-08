import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// ---------------------------------------------------------
// AdminLogin — the ONLY entry point into this app. Deliberately
// has no signup link, no "forgot password" flow, no marketing
// copy — admins are provisioned out-of-band via
// backend/scripts/makeAdmin.js, never self-served.
//
// Hits the exact same POST /api/auth/login endpoint the main
// frontend uses. If login succeeds but the account isn't
// ADMIN, we log them straight back out — this app has nothing
// else for a non-admin account to do.
// ---------------------------------------------------------
export default function AdminLogin() {
  const { login, logout, isAuthenticated, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Already logged in as admin? Skip straight to the dashboard.
  if (!authLoading && isAuthenticated && user?.role === "ADMIN") {
    return <Navigate to="/admin-dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser?.role !== "ADMIN") {
        await logout();
        setError("This account does not have admin access.");
        return;
      }
      navigate("/admin-dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b14] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <ShieldCheck className="text-purple-400" size={24} />
          </div>
          <h1 className="text-lg font-semibold text-white">FocusForge AI</h1>
          <p className="text-xs text-gray-500 tracking-wide uppercase">Admin Access</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#13131f] border border-white/5 rounded-2xl p-6 flex flex-col gap-4"
        >
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#0b0b14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
              placeholder="admin@focusforge.app"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#0b0b14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-3 py-2.5 transition"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={16} /> Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-6">
          Restricted access · FocusForge AI internal
        </p>
      </div>
    </div>
  );
}
