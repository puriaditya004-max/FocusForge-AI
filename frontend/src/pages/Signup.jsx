import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  UserPlus,
  GraduationCap,
  Users,
  School,
  Calendar,
  ShieldCheck,
  BadgeCheck,
  Target,
  Image as ImageIcon,
} from "lucide-react";

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

const PREPARATION_TRACKS = [
  { id: "CLASS_10", label: "Class 10" },
  { id: "CLASS_12", label: "Class 12" },
  { id: "NEET", label: "NEET" },
  { id: "JEE", label: "JEE" },
  { id: "UPSC", label: "UPSC" },
  { id: "MPSC", label: "MPSC" },
  { id: "MEDICAL", label: "Medical field" },
  { id: "ENGINEERING", label: "Engineering" },
  { id: "LLB", label: "LLB" },
  { id: "OTHER", label: "Other" },
];

function passwordIsStrong(password) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export default function Signup() {
  const [step, setStep] = useState("ACCOUNT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [preparationTrack, setPreparationTrack] = useState("CLASS_12");
  const [preparationOther, setPreparationOther] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [issuedDigitalId, setIssuedDigitalId] = useState("");

  const { user, signup, verifyEmail, resendEmailVerification, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    if (user.role === "STUDENT" && !user.onboardingCompletedAt) {
      setStep("ONBOARDING");
      setName(user.name || "");
      setEmail(user.email || "");
      if (user.dateOfBirth) setDateOfBirth(String(user.dateOfBirth).slice(0, 10));
      if (user.preparationTrack) setPreparationTrack(user.preparationTrack);
      if (user.preparationOther) setPreparationOther(user.preparationOther);
      if (user.avatarUrl) setAvatarUrl(user.avatarUrl);
      return;
    }
    navigate(ROLE_HOME[user.role] || "/dashboard", { replace: true });
  }, [navigate, user]);

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!name || !email) {
      setError("Please enter your name and email.");
      return;
    }

    setLoading(true);
    try {
      const data = await signup(name, email, role);
      setVerificationToken(data.verificationToken);
      setNotice(data.devCode ? `OTP sent. Dev code: ${data.devCode}` : "OTP sent to your email. Verify to continue.");
      setStep("VERIFY");
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
      if (data.user.role !== "STUDENT") {
        navigate(ROLE_HOME[data.user.role] || "/dashboard");
        return;
      }
      setNotice("Email verified. Complete your student profile to generate your Digital ID.");
      setStep("ONBOARDING");
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

  async function handleCompleteOnboarding(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!dateOfBirth) {
      setError("Date of birth is required.");
      return;
    }
    if (preparationTrack === "OTHER" && !preparationOther.trim()) {
      setError("Please enter your preparation goal.");
      return;
    }
    if (!passwordIsStrong(password)) {
      setError("Password must be 8+ characters with a letter, number, and special character.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const data = await completeOnboarding({
        preparationTrack,
        preparationOther,
        dateOfBirth,
        avatarUrl,
        password,
      });
      setIssuedDigitalId(data.digitalId?.cardNumber || data.user?.digitalId?.cardNumber || "");
      setNotice("Digital ID generated. Use this ID with your password for future logins.");
      setStep("DONE");
    } catch (err) {
      setError(err.message || "Could not complete onboarding.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src="/icon-192.png" alt="FocusForge AI" className="w-14 h-14 rounded-2xl mx-auto mb-3" />
          <h1 className="text-lg font-semibold">FocusForge AI</h1>
          <p className="text-xs text-gray-500 mt-1">Discipline Today, Freedom Tomorrow</p>
        </div>

        <div className="bg-[#13131f] rounded-2xl border border-white/5 p-6">
          <StepHeader step={step} />

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

          {step === "ACCOUNT" && (
            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <div>
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

              <TextInput label="Full name" icon={User} value={name} setValue={setName} placeholder="Enter your full name" />
              <TextInput label="Email" icon={Mail} type="email" value={email} setValue={setEmail} placeholder="you@example.com" />

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                {loading ? "Sending OTP..." : <><UserPlus size={15} /> Create Account</>}
              </button>
            </form>
          )}

          {step === "VERIFY" && (
            <form onSubmit={handleVerifyEmail} className="flex flex-col gap-4">
              <TextInput label="Email" icon={Mail} type="email" value={email} setValue={setEmail} disabled />
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
              <button type="button" onClick={handleResendOtp} disabled={loading} className="text-xs text-purple-300 hover:text-purple-200 disabled:opacity-50">
                Resend OTP
              </button>
            </form>
          )}

          {step === "ONBOARDING" && (
            <form onSubmit={handleCompleteOnboarding} className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] text-gray-500 mb-2 block">What are you preparing for?</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PREPARATION_TRACKS.map((track) => (
                    <button
                      type="button"
                      key={track.id}
                      onClick={() => setPreparationTrack(track.id)}
                      className={`px-3 py-2 rounded-lg border text-xs transition ${
                        preparationTrack === track.id
                          ? "bg-purple-600 border-purple-500 text-white"
                          : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      {track.label}
                    </button>
                  ))}
                </div>
              </div>

              {preparationTrack === "OTHER" && (
                <TextInput label="Preparation goal" icon={Target} value={preparationOther} setValue={setPreparationOther} placeholder="CA, BBA, NDA..." />
              )}

              <TextInput
                label="Date of birth"
                icon={Calendar}
                type="date"
                value={dateOfBirth}
                setValue={setDateOfBirth}
                max={new Date().toISOString().split("T")[0]}
              />
              <TextInput label="Photo URL (optional)" icon={ImageIcon} value={avatarUrl} setValue={setAvatarUrl} placeholder="https://..." />

              <PasswordInput
                label="Set password"
                password={password}
                setPassword={setPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
              />
              <PasswordInput
                label="Confirm password"
                password={confirmPassword}
                setPassword={setConfirmPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
              />

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                {loading ? "Generating ID..." : <><BadgeCheck size={15} /> Generate Digital ID</>}
              </button>
            </form>
          )}

          {step === "DONE" && (
            <div className="text-center">
              <BadgeCheck size={34} className="text-green-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold">Your Digital ID is ready</h3>
              <p className="text-xs text-gray-400 mt-2">Use this ID and your password whenever you log in.</p>
              <div className="mt-5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-purple-200/80">Digital ID</p>
                <p className="font-mono text-lg font-semibold mt-1">{issuedDigitalId}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="mt-5 w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm font-medium"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          <p className="text-[11px] text-gray-500 text-center mt-4">
            By signing up, you agree to our{" "}
            <a href="/terms" className="text-purple-400 hover:underline">Terms</a>,{" "}
            <a href="/privacy-policy" className="text-purple-400 hover:underline">Privacy Policy</a>,{" "}
            <a href="/subscription-policy" className="text-purple-400 hover:underline">Subscription Policy</a>, and{" "}
            <a href="/refund-policy" className="text-purple-400 hover:underline">Refund Policy</a>.
          </p>
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

function StepHeader({ step }) {
  const copy = {
    ACCOUNT: ["Create your account", "Enter your name and verify your email first."],
    VERIFY: ["Verify your email", "Enter the OTP sent to your email."],
    ONBOARDING: ["Complete student profile", "Set your goal, DOB, password, and generate your Digital ID."],
    DONE: ["Account complete", "Your FocusForge identity is ready."],
  };
  const [title, subtitle] = copy[step] || copy.ACCOUNT;
  return (
    <>
      <h2 className="text-sm font-semibold mb-1">{title}</h2>
      <p className="text-xs text-gray-500 mb-5">{subtitle}</p>
    </>
  );
}

function TextInput({ label, icon: Icon, type = "text", value, setValue, placeholder, disabled = false, max }) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 mb-1 block">{label}</label>
      <div className="relative">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type={type}
          value={value}
          disabled={disabled}
          max={max}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-100 disabled:opacity-70 focus:outline-none focus:border-purple-500/50"
        />
      </div>
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
