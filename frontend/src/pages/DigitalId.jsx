import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { IdCard, Download, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";

// ---------------------------------------------------------
// DigitalId Page
// Shows the student's auto-generated Digital ID card. On first
// visit the backend issues one (GET /api/digital-id/me), as long
// as email or mobile has actually been verified — otherwise it
// shows a clear "verify first" state instead of a blank card.
//
// The QR code encodes a public verify URL (no login needed) so
// anyone scanning the card — a teacher, a parent, a proctor —
// can confirm it's real without ever seeing the student's email,
// mobile, or date of birth.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function DigitalId() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [card, setCard] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
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
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to load Digital ID.");
      }

      setCard(data.card);
      await buildQr(data.card.verifyToken);
    } catch (err) {
      setError(err.message || "Something went wrong loading your Digital ID.");
    } finally {
      setLoading(false);
    }
  }

  async function buildQr(token) {
    try {
      const QRCode = (await import("qrcode")).default;
      const verifyUrl = `${window.location.origin}/verify-id/${token}`;
      const dataUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 180,
        color: { dark: "#111827", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      // QR is a nice-to-have on top of the card — don't fail the whole page over it.
      setQrDataUrl(null);
    }
  }

  function downloadCard() {
    if (!cardRef.current) return;
    import("html2canvas")
      .then(({ default: html2canvas }) => {
        html2canvas(cardRef.current, { scale: 2, backgroundColor: null }).then((canvas) => {
          const link = document.createElement("a");
          link.download = `FocusForge_Digital_ID.png`;
          link.href = canvas.toDataURL();
          link.click();
        });
      })
      .catch(() => {
        alert("html2canvas not installed. Run: npm install html2canvas");
      });
  }

  const issueDate = card
    ? new Date(card.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <TopBar userName={user?.name || "Student"} streak={user?.currentStreak || 0} level={user?.level || 1} />

        <div className="px-6 mt-4 mb-8 flex flex-col items-center gap-5">
          <div className="text-center">
            <h1 className="text-lg font-semibold flex items-center justify-center gap-2">
              <IdCard className="text-purple-400" size={20} />
              Digital ID Card
            </h1>
            <p className="text-sm text-gray-400">Your verified FocusForge identity, issued once and always yours.</p>
          </div>

          {loading && <p className="text-sm text-gray-400 mt-8">Loading your Digital ID...</p>}

          {!loading && needsVerification && (
            <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <ShieldAlert className="mx-auto text-yellow-400 mb-3" size={32} />
              <h2 className="text-base font-semibold mb-1">Verify your identity first</h2>
              <p className="text-sm text-gray-400 mb-4">
                Your Digital ID is issued automatically once your email or mobile number is verified. Head to
                Settings to complete verification.
              </p>
              <a
                href="/settings"
                className="inline-block bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
              >
                Go to Settings
              </a>
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
            <>
              <div
                ref={cardRef}
                className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden text-white"
                style={{
                  background: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 45%, #1e1b4b 100%)",
                  fontFamily: "Georgia, serif",
                }}
              >
                <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/15">
                  <div>
                    <p className="text-[10px] tracking-[0.3em] uppercase font-sans font-semibold text-purple-200">
                      FocusForge AI
                    </p>
                    <p className="text-sm font-sans text-purple-100">Digital ID</p>
                  </div>
                  <ShieldCheck className="text-green-300" size={22} />
                </div>

                <div className="px-6 py-5 flex gap-4 items-center">
                  <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center text-2xl font-bold flex-shrink-0 font-sans">
                    {user?.name?.charAt(0)?.toUpperCase() || "S"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold truncate">{user?.name}</p>
                    <p className="text-xs font-sans text-purple-200 uppercase tracking-wide">{card && (user?.role || "STUDENT")}</p>
                    <p className="text-xs font-sans text-purple-200 mt-1">Issued {issueDate}</p>
                  </div>
                </div>

                <div className="px-6 pb-5 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-purple-300 font-sans uppercase tracking-wider mb-1">Card Number</p>
                    <p className="text-sm font-mono">{card.cardNumber}</p>
                    <p className="text-[10px] text-purple-300 font-sans mt-2">
                      Status: <span className={card.status === "ACTIVE" ? "text-green-300" : "text-red-300"}>{card.status}</span>
                    </p>
                  </div>
                  {qrDataUrl && (
                    <img src={qrDataUrl} alt="Scan to verify" className="w-20 h-20 rounded-lg bg-white p-1" />
                  )}
                </div>

                <div className="h-2 bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-400" />
              </div>

              <div className="flex gap-3 flex-wrap justify-center">
                <button
                  onClick={downloadCard}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm"
                >
                  <Download size={16} /> Download ID Card
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center max-w-sm">
                Anyone can scan the QR code to confirm this ID is real — it only reveals your name, role, and issue
                date, never your email, mobile, or date of birth.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
