import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, User, Eye, EyeOff, UserPlus, GraduationCap, Users, School, Calendar, Phone, ShieldCheck } from "lucide-react";

// ---------------------------------------------------------
// Signup Page — same dark/purple theme as the rest of the app.
// Now includes a role picker: Student / Parent / Teacher.
// On success, redirects to the correct dashboard for that role.
// ---------------------------------------------------------

const ROLES = [
  { id: "STUDENT", label: "Student", icon: GraduationCap },
  { id: "PARENT", label: "Parent", icon: Users },
  { id: "TEACHER", label: "Teacher", icon: School },
];

const ROLE_HOME = {
  STUDENT: "/dashboard",
  PARENT: "/parent-dashboard",
  TEACHER: "/teacher-dashboard",
};

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pendingRole, setPendingRole] = useState("STUDENT");

  const { signup, verifyEmail, resendEmailVerification } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!name || !email || !password || !confirmPassword || !dateOfBirth) {
      setError("Please fill in all fields.");
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password) || password.length < 8) {
      setError("Password must be 8+ characters with a letter, number, and special character.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const data = await signup(name, email, password, role, dateOfBirth, mobileNumber);
      if (data.verificationToken) {
        setVerificationToken(data.verificationToken);
        setPendingRole(data.user?.role || role);
        setNotice(data.devCode ? `OTP sent. Dev code: ${data.devCode}` : "OTP sent to your email. Verify to continue.");
        return;
      }
      navigate(ROLE_HOME[data.user.role] || "/dashboard");
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!/^\d{6}$/.test(otpCode)) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      const data = await verifyEmail(verificationToken, otpCode);
      navigate(ROLE_HOME[data.user.role] || ROLE_HOME[pendingRole] || "/dashboard");
    } catch (err) {
      setError(err.message || "Email verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const data = await resendEmailVerification(verificationToken);
      setVerificationToken(data.verificationToken || verificationToken);
      setNotice(data.devCode ? `OTP sent. Dev code: ${data.devCode}` : "New OTP sent to your email.");
    } catch (err) {
      setError(err.message || "Could not resend OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-white text-lg mx-auto mb-3">
            F
          </div>
          <h1 className="text-lg font-semibold">FocusForge AI</h1>
          <p className="text-xs text-gray-500 mt-1">Discipline Today, Freedom Tomorrow</p>
        </div>

        <div className="bg-[#13131f] rounded-2xl border border-white/5 p-6">
          <h2 className="text-sm font-semibold mb-1">{verificationToken ? "Verify your email" : "Create your account"}</h2>
          <p className="text-xs text-gray-500 mb-5">
            {verificationToken ? "Enter the OTP sent to your email." : "Start your study journey today."}
          </p>

          {notice && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 mb-4">
              <p className="text-xs text-green-300">{notice}</p>
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {verificationToken ? (
            <form onSubmit={handleVerifyEmail} className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-100 opacity-70"
                  />
                </div>
              </div>
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit OTP"
                inputMode="numeric"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-100 tracking-[0.3em] focus:outline-none focus:border-purple-500/50"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                {loading ? "Verifying..." : <><ShieldCheck size={15} /> Verify Email</>}
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="text-xs text-purple-300 hover:text-purple-200 disabled:opacity-50"
              >
                Resend OTP
              </button>
            </form>
          ) : (
            <>
          {/* Role picker */}
          <div className="mb-4">
            <label className="text-[11px] text-gray-500 mb-2 block">I am a...</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const active = role === r.id;
                return (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs transition ${
                      active
                        ? "bg-purple-600 border-purple-600 text-white"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    <Icon size={16} />
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">Full name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aryan Sharma"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

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
              <label className="text-[11px] text-gray-500 mb-1 block">Date of birth</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">Mobile number (for OTP)</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="+91..."
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
                  placeholder="8+ chars, number & symbol"
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

            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">Confirm password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-sm font-medium flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                "Creating account..."
              ) : (
                <>
                  <UserPlus size={15} /> Sign Up
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-gray-500 text-center mt-4">
            By signing up, you agree to our{" "}
            <a href="/terms" className="text-purple-400 hover:underline">Terms of Service</a> and{" "}
            <a href="/privacy-policy" className="text-purple-400 hover:underline">Privacy Policy</a>. Paid access is also
            covered by our{" "}
            <a href="/subscription-policy" className="text-purple-400 hover:underline">
              Subscription Policy
            </a>{" "}
            and{" "}
            <a href="/refund-policy" className="text-purple-400 hover:underline">
              Refund Policy
            </a>
            .
          </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-purple-300 hover:text-purple-200 font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
