import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import {
  Contact,
  Download,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Mail,
  Smartphone,
  Loader2,
  Copy,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function DigitalId() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [card, setCard] = useState(null);
  const [holder, setHolder] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [verifyChannel, setVerifyChannel] = useState("EMAIL");
  const [verifyTarget, setVerifyTarget] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStatus, setOtpStatus] = useState("");
  const [otpError, setOtpError] = useState("");
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const cardRef = useRef(null);

  useEffect(() => {
    loadCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCard() {
    setLoading(true);
    setError("");
    setNeedsVerification(false);
    try {
      const res = await fetch(`${API_BASE}/digital-id/me`, { credentials: "include" });
      const data = await res.json();

      if (res.status === 403 && data.code === "IDENTITY_NOT_VERIFIED") {
        setNeedsVerification(true);
        setVerifyTarget(user?.email || "");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to load Digital ID.");

      setCard(data.card);
      setHolder(data.holder || null);
      setSubscription(data.subscription || null);
      await buildQr(data.card.verifyToken);
    } catch (err) {
      setError(err.message || "Something went wrong loading your Digital ID.");
    } finally {
      setLoading(false);
    }
  }

  function switchChannel(channel) {
    setVerifyChannel(channel);
    setVerifyTarget(channel === "EMAIL" ? user?.email || "" : user?.mobileNumber || "");
    setOtpCode("");
    setOtpStatus("");
    setOtpError("");
  }

  async function requestOtp() {
    const target = verifyTarget.trim();
    if (!target) {
      setOtpError(verifyChannel === "EMAIL" ? "Enter your email address." : "Enter your mobile number.");
      return;
    }

    setRequestingOtp(true);
    setOtpError("");
    setOtpStatus("");
    try {
      const res = await fetch(`${API_BASE}/auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channel: verifyChannel, target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Could not send OTP.");
      setOtpStatus(data.devCode ? `OTP sent. Dev code: ${data.devCode}` : "OTP sent. Check your inbox or phone.");
    } catch (err) {
      setOtpError(err.message || "Could not send OTP.");
    } finally {
      setRequestingOtp(false);
    }
  }

  async function verifyOtp() {
    const target = verifyTarget.trim();
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setOtpError("Enter the 6-digit OTP.");
      return;
    }

    setVerifyingOtp(true);
    setOtpError("");
    try {
      const res = await fetch(`${API_BASE}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channel: verifyChannel, target, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "OTP verification failed.");
      setOtpStatus("Verified. Issuing your Digital ID...");
      setNeedsVerification(false);
      setOtpCode("");
      await loadCard();
    } catch (err) {
      setOtpError(err.message || "OTP verification failed.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function buildQr(token) {
    try {
      const QRCode = (await import("qrcode")).default;
      const verifyUrl = `${window.location.origin}/verify-id/${token}`;
      const dataUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 220,
        color: { dark: "#111827", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
    } catch {
      setQrDataUrl(null);
    }
  }

  function downloadCard() {
    if (!cardRef.current) return;
    import("html2canvas")
      .then(({ default: html2canvas }) => {
        html2canvas(cardRef.current, { scale: 3, backgroundColor: null }).then((canvas) => {
          const link = document.createElement("a");
          link.download = `FocusForge_Digital_ID_${card?.cardNumber || "card"}.png`;
          link.href = canvas.toDataURL();
          link.click();
        });
      })
      .catch(() => {
        alert("Could not prepare the card image. Please try again.");
      });
  }

  async function copyVerifyLink() {
    if (!card?.verifyToken) return;
    const verifyUrl = `${window.location.origin}/verify-id/${card.verifyToken}`;
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
    }
    setTimeout(() => setCopyStatus(""), 1500);
  }

  function openVerifyPage() {
    if (!card?.verifyToken) return;
    window.open(`/verify-id/${card.verifyToken}`, "_blank", "noopener,noreferrer");
  }

  const issueDate = card
    ? new Date(card.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const displayName = holder?.name || user?.name || "Student";
  const displayRole = holder?.role || user?.role || "STUDENT";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "S";
  const subscriptionStatus = subscription?.status || "NONE";
  const subscriptionLabel =
    subscriptionStatus === "TRIALING"
      ? "Trial"
      : subscriptionStatus === "ACTIVE"
        ? "Active"
        : subscriptionStatus === "GRACE"
          ? "Grace"
          : "Expired";
  const subscriptionClass =
    subscriptionStatus === "ACTIVE"
      ? "bg-green-400/15 border-green-300/25 text-green-200"
      : subscriptionStatus === "TRIALING"
        ? "bg-purple-400/15 border-purple-300/25 text-purple-100"
        : subscriptionStatus === "GRACE"
          ? "bg-yellow-400/15 border-yellow-300/25 text-yellow-100"
          : "bg-red-400/15 border-red-300/25 text-red-100";

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <TopBar userName={displayName} streak={user?.currentStreak || 0} level={user?.level || 1} />

        <div className="px-4 md:px-6 mt-4 mb-8 flex flex-col items-center gap-5">
          <div className="text-center max-w-xl">
            <h1 className="text-xl font-semibold flex items-center justify-center gap-2">
              <Contact className="text-purple-400" size={21} />
              Digital ID Card
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              A scannable FocusForge identity card for student verification checks.
            </p>
          </div>

          {loading && <p className="text-sm text-gray-400 mt-8">Loading your Digital ID...</p>}

          {!loading && needsVerification && (
            <div className="w-full max-w-xl bg-white/5 border border-white/10 rounded-2xl p-6">
              <ShieldAlert className="mx-auto text-yellow-400 mb-3" size={32} />
              <h2 className="text-base font-semibold mb-1 text-center">Verify your identity first</h2>
              <p className="text-sm text-gray-400 mb-5 text-center">
                Your Digital ID is issued automatically after one OTP check. Choose email or mobile, verify the code,
                and your card will appear here.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => switchChannel("EMAIL")}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                    verifyChannel === "EMAIL"
                      ? "bg-purple-600/20 border-purple-500/40 text-purple-200"
                      : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                  }`}
                >
                  <Mail size={16} /> Email
                </button>
                <button
                  onClick={() => switchChannel("MOBILE")}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                    verifyChannel === "MOBILE"
                      ? "bg-purple-600/20 border-purple-500/40 text-purple-200"
                      : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                  }`}
                >
                  <Smartphone size={16} /> Mobile
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] mb-3">
                <input
                  value={verifyTarget}
                  onChange={(e) => setVerifyTarget(e.target.value)}
                  disabled={verifyChannel === "EMAIL"}
                  placeholder={verifyChannel === "EMAIL" ? "Email address" : "Mobile number with country code"}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-100 outline-none disabled:opacity-70 focus:border-purple-500/50"
                />
                <button
                  onClick={requestOtp}
                  disabled={requestingOtp}
                  className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
                >
                  {requestingOtp ? <Loader2 size={16} className="animate-spin" /> : null}
                  Send OTP
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit OTP"
                  inputMode="numeric"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-100 tracking-[0.3em] outline-none focus:border-purple-500/50"
                />
                <button
                  onClick={verifyOtp}
                  disabled={verifyingOtp}
                  className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
                >
                  {verifyingOtp ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Verify
                </button>
              </div>

              {otpStatus && <p className="text-xs text-green-400 mt-3 text-center">{otpStatus}</p>}
              {otpError && <p className="text-xs text-red-400 mt-3 text-center">{otpError}</p>}
            </div>
          )}

          {!loading && error && !needsVerification && (
            <div className="w-full max-w-md bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
              <p className="text-sm text-red-300 mb-3">{error}</p>
              <button
                onClick={loadCard}
                className="inline-flex items-center gap-2 border border-white/10 hover:bg-white/5 px-4 py-2 rounded-xl text-sm text-gray-300"
              >
                <RefreshCw size={14} /> Try again
              </button>
            </div>
          )}

          {!loading && card && (
            <div className="grid grid-cols-1 xl:grid-cols-[420px_320px] gap-5 items-start">
              <div
                ref={cardRef}
                className="w-full max-w-[420px] rounded-2xl shadow-2xl overflow-hidden text-white border border-white/15"
                style={{
                  background: "linear-gradient(135deg, #1e1238 0%, #4c1d95 42%, #111827 100%)",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/15">
                  <div>
                    <p className="text-[10px] tracking-[0.28em] uppercase font-semibold text-purple-200">
                      FocusForge AI
                    </p>
                    <p className="text-sm text-purple-100">Verified Digital Identity</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-green-400/15 border border-green-300/25 px-2.5 py-1">
                    <ShieldCheck className="text-green-300" size={14} />
                    <span className="text-[10px] font-semibold text-green-200">{card.status}</span>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <div className="flex gap-4 items-center">
                    <div className="w-20 h-20 rounded-2xl bg-white/12 border border-white/15 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-bold truncate">{displayName}</p>
                      <p className="text-xs text-purple-200 uppercase tracking-[0.18em] mt-1">{displayRole}</p>
                      <p className="text-xs text-purple-200 mt-2">Issued {issueDate}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-5">
                    <div className="rounded-xl bg-white/8 border border-white/10 p-3">
                      <p className="text-[10px] text-purple-200 uppercase tracking-wider mb-1">Card Number</p>
                      <p className="text-sm font-mono break-all">{card.cardNumber}</p>
                    </div>
                    <div className="rounded-xl bg-white/8 border border-white/10 p-3">
                      <p className="text-[10px] text-purple-200 uppercase tracking-wider mb-1">Verification</p>
                      <p className="text-sm font-semibold flex items-center gap-1 text-green-200">
                        <CheckCircle2 size={14} /> QR Active
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/8 border border-white/10 p-3 col-span-2">
                      <p className="text-[10px] text-purple-200 uppercase tracking-wider mb-1">Subscription</p>
                      <p className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${subscriptionClass}`}>
                        {subscriptionLabel}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] text-purple-300 uppercase tracking-wider mb-1">Public Check</p>
                    <p className="text-xs text-purple-100 max-w-[210px]">
                      Scan to confirm this card without exposing email, mobile, or date of birth.
                    </p>
                  </div>
                  {qrDataUrl && (
                    <img src={qrDataUrl} alt="Scan to verify" className="w-24 h-24 rounded-xl bg-white p-1.5" />
                  )}
                </div>

                <div className="h-2 bg-gradient-to-r from-purple-400 via-fuchsia-400 to-green-300" />
              </div>

              <div className="w-full max-w-[420px] xl:max-w-none rounded-2xl bg-white/5 border border-white/10 p-5">
                <h2 className="text-sm font-semibold text-gray-100 mb-3">Card Actions</h2>
                <div className="grid gap-2">
                  <button
                    onClick={downloadCard}
                    className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm"
                  >
                    <Download size={16} /> Download ID Card
                  </button>
                  <button
                    onClick={copyVerifyLink}
                    className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-semibold px-5 py-2.5 rounded-xl transition text-sm"
                  >
                    <Copy size={16} /> Copy Verification Link
                  </button>
                  <button
                    onClick={openVerifyPage}
                    className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-semibold px-5 py-2.5 rounded-xl transition text-sm"
                  >
                    <ExternalLink size={16} /> Open Public Check
                  </button>
                </div>
                {copyStatus && <p className="text-xs text-green-400 text-center mt-3">{copyStatus}</p>}
                <div className="mt-5 pt-4 border-t border-white/10">
                  <p className="text-[11px] text-gray-500 mb-2">Verification shares only:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-300">Name</span>
                    <span className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-300">Role</span>
                    <span className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-300">Card No.</span>
                    <span className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-300">Issue Date</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-3">
                    Private details like email, mobile number, and date of birth are never shown on the public verification page.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
