import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BadgeCheck, Mail, Lock, Eye, EyeOff, LogIn, ShieldCheck, RotateCcw } from "lucide-react";

const ROLE_HOME = {
  STUDENT: "/dashboard",
  PARENT: "/parent-dashboard",
  TEACHER: "/teacher-dashboard",
};

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("LOGIN");
  const [verificationToken, setVerificationToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const { login, verifyEmail, resendEmailVerification, requestPasswordReset, resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function goHome(user) {
    navigate(ROLE_HOME[user.role] || "/dashboard");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!identifier || !password) {
      setError("Please enter your Digital ID and password.");
      return;
    }

    setLoading(true);
    try {
      const data = await login(identifier, password);
      if (data.code === "EMAIL_VERIFICATION_REQUIRED") {
        setVerificationToken(data.verificationToken);
        setRecoveryEmail(data.email || identifier);
        setMode("VERIFY_EMAIL");
        setCooldown(30);
        setNotice(data.devCode ? `OTP sent. Dev code: ${data.devCode}` : "OTP sent to your email.");
        return;
      }
      if (data.code === "ONBOARDING_REQUIRED") {
        navigate("/signup");
        return;
      }
      goHome(data.user);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
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
      goHome(data.user);
    } catch (err) {
      setError(err.message || "Email verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!verificationToken || cooldown > 0) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const data = await resendEmailVerification(verificationToken);
      setVerificationToken(data.verificationToken || verificationToken);
      setCooldown(30);
      setNotice(data.devCode ? `OTP sent. Dev code: ${data.devCode}` : "New OTP sent to your email.");
    } catch (err) {
      setError(err.message || "Could not resend OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestReset(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!recoveryEmail) {
      setError("Enter your email first.");
      return;
    }

    setLoading(true);
    try {
      const data = await requestPasswordReset(recoveryEmail);
      setMode("RESET_PASSWORD");
      setNotice(data.message || "If this email exists, a reset OTP has been sent.");
    } catch (err) {
      setError(err.message || "Could not send reset OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!/^\d{6}$/.test(resetCode)) {
      setError("Enter the 6-digit reset OTP.");
      return;
    }

    setLoading(true);
    try {
      const data = await resetPassword(recoveryEmail, resetCode, newPassword);
      setMode("LOGIN");
      setPassword("");
      setResetCode("");
      setNewPassword("");
      setNotice(data.message || "Password reset successfully. You can log in now.");
    } catch (err) {
      setError(err.message || "Could not reset password.");
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
          <h2 className="text-sm font-semibold mb-1">
            {mode === "VERIFY_EMAIL" ? "Verify your email" : mode === "RESET_PASSWORD" ? "Reset password" : "Welcome back"}
          </h2>
          <p className="text-xs text-gray-500 mb-5">
            {mode === "VERIFY_EMAIL"
              ? "Enter the OTP sent to your email."
              : mode === "RESET_PASSWORD"
                ? "Enter the reset OTP and your new password."
                : "Use your FocusForge Digital ID after onboarding is complete."}
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

          {mode === "LOGIN" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <DigitalIdInput identifier={identifier} setIdentifier={setIdentifier} />
              <PasswordInput
                label="Password"
                password={password}
                setPassword={setPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
              />
              <button
                type="button"
                onClick={() => {
                  setRecoveryEmail(identifier.includes("@") ? identifier : "");
                  setMode("REQUEST_RESET");
                  setError("");
                  setNotice("");
                }}
                className="self-end text-xs text-purple-300 hover:text-purple-200"
              >
                Forgot password?
              </button>
              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                {loading ? "Logging in..." : <><LogIn size={15} /> Log In</>}
              </button>
            </form>
          )}

          {mode === "VERIFY_EMAIL" && (
            <form onSubmit={handleVerifyEmail} className="flex flex-col gap-4">
              <EmailInput email={recoveryEmail} setEmail={setRecoveryEmail} disabled />
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="6-digit OTP"
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
                onClick={handleResend}
                disabled={loading || cooldown > 0}
                className="text-xs text-purple-300 hover:text-purple-200 disabled:opacity-50"
              >
                {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
              </button>
            </form>
          )}

          {mode === "REQUEST_RESET" && (
            <form onSubmit={handleRequestReset} className="flex flex-col gap-4">
              <EmailInput email={recoveryEmail} setEmail={setRecoveryEmail} />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                {loading ? "Sending..." : <><RotateCcw size={15} /> Send Reset OTP</>}
              </button>
              <button type="button" onClick={() => setMode("LOGIN")} className="text-xs text-gray-400 hover:text-gray-200">
                Back to login
              </button>
            </form>
          )}

          {mode === "RESET_PASSWORD" && (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <EmailInput email={recoveryEmail} setEmail={setRecoveryEmail} disabled />
              <input
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="6-digit reset OTP"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-100 tracking-[0.3em] focus:outline-none focus:border-purple-500/50"
              />
              <PasswordInput
                label="New password"
                password={newPassword}
                setPassword={setNewPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-sm font-medium transition-all"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}
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

function EmailInput({ email, setEmail, disabled = false }) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 mb-1 block">Email</label>
      <div className="relative">
        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="email"
          value={email}
          disabled={disabled}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-100 disabled:opacity-70 focus:outline-none focus:border-purple-500/50"
        />
      </div>
    </div>
  );
}

function DigitalIdInput({ identifier, setIdentifier }) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 mb-1 block">Digital ID</label>
      <div className="relative">
        <BadgeCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value.toUpperCase())}
          placeholder="FF-STU-8K3F9QRT"
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-100 font-mono focus:outline-none focus:border-purple-500/50"
        />
      </div>
      <p className="mt-1 text-[11px] text-gray-500">New students receive this ID after email verification and onboarding.</p>
    </div>
  );
}

function PasswordInput({ label, password, setPassword, showPassword, setShowPassword }) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 mb-1 block">{label}</label>
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
  );
}
