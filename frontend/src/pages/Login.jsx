import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, Eye, EyeOff, LogIn } from "lucide-react";

// ---------------------------------------------------------
// Login Page — same dark/purple theme as the rest of the app.
// On success, redirects based on the logged-in user's role:
//   STUDENT -> /dashboard
//   PARENT  -> /parent-dashboard
//   TEACHER -> /teacher-dashboard
// ---------------------------------------------------------

const ROLE_HOME = {
  STUDENT: "/dashboard",
  PARENT: "/parent-dashboard",
  TEACHER: "/teacher-dashboard",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(ROLE_HOME[user.role] || "/dashboard");
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-white text-lg mx-auto mb-3">
            F
          </div>
          <h1 className="text-lg font-semibold">FocusForge AI</h1>
          <p className="text-xs text-gray-500 mt-1">Discipline Today, Freedom Tomorrow</p>
        </div>

        <div className="bg-[#13131f] rounded-2xl border border-white/5 p-6">
          <h2 className="text-sm font-semibold mb-1">Welcome back</h2>
          <p className="text-xs text-gray-500 mb-5">Log in to continue your journey.</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-9 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-purple-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-sm font-medium flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                "Logging in..."
              ) : (
                <>
                  <LogIn size={15} /> Log In
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 mt-5">
          Don't have an account?{" "}
          <Link to="/signup" className="text-purple-300 hover:text-purple-200 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}