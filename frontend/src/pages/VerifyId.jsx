import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ShieldCheck, ShieldX, Loader2, BadgeCheck, CalendarDays, Contact, UserRound } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function VerifyId() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/digital-id/verify/${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => setResult(data))
      .catch(() => setResult({ valid: false, error: "Could not reach the verification service." }))
      .finally(() => setLoading(false));
  }, [token]);

  const valid = result?.valid;

  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-5">
          <p className="text-xs tracking-[0.3em] uppercase font-semibold text-purple-300">FocusForge AI</p>
          <h1 className="text-2xl font-bold mt-2">Digital ID Verification</h1>
          <p className="text-sm text-gray-400 mt-1">Public verification check for a FocusForge Digital ID card.</p>
        </div>

        <div
          className={`rounded-2xl border p-6 text-center shadow-2xl ${
            valid
              ? "bg-green-500/8 border-green-400/25"
              : loading
                ? "bg-white/5 border-white/10"
                : "bg-red-500/8 border-red-400/25"
          }`}
        >
          {loading && (
            <>
              <Loader2 className="mx-auto text-purple-300 mb-3 animate-spin" size={40} />
              <h2 className="text-lg font-bold mb-1">Checking ID card</h2>
              <p className="text-sm text-gray-400">Please wait while we verify this QR code.</p>
            </>
          )}

          {!loading && valid && (
            <>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-green-400/15 border border-green-300/25 flex items-center justify-center mb-4">
                <ShieldCheck className="text-green-300" size={36} />
              </div>
              <h2 className="text-xl font-bold mb-1">Verified ID</h2>
              <p className="text-sm text-green-200 mb-5">This Digital ID is active and was issued by FocusForge AI.</p>

              <div className="grid gap-3 text-left">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
                  <UserRound className="text-purple-300 flex-shrink-0" size={18} />
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider">Holder</p>
                    <p className="text-sm font-semibold text-gray-100">{result.name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
                    <BadgeCheck className="text-green-300 flex-shrink-0" size={18} />
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider">Role</p>
                      <p className="text-sm font-semibold text-gray-100">{result.role}</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
                    <CalendarDays className="text-blue-300 flex-shrink-0" size={18} />
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider">Issued</p>
                      <p className="text-sm font-semibold text-gray-100">{formatDate(result.issuedAt)}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
                  <Contact className="text-purple-300 flex-shrink-0" size={18} />
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider">Card Number</p>
                    <p className="text-sm font-mono text-gray-100 break-all">{result.cardNumber}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {!loading && result && !valid && (
            <>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-400/15 border border-red-300/25 flex items-center justify-center mb-4">
                <ShieldX className="text-red-300" size={36} />
              </div>
              <h2 className="text-xl font-bold mb-1">Not Valid</h2>
              <p className="text-sm text-gray-400">
                {result.error || "This Digital ID could not be verified."}
              </p>
            </>
          )}
        </div>

        <p className="text-[11px] text-gray-600 text-center mt-4 leading-relaxed">
          This page only confirms ID status, holder name, role, card number, and issue date. It never exposes private
          contact details.
        </p>
      </div>
    </div>
  );
}
