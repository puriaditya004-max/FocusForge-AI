import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ShieldCheck, ShieldX } from "lucide-react";

// ---------------------------------------------------------
// VerifyId Page — PUBLIC, no auth. This is what scanning a
// student's Digital ID QR code opens. Hits the public
// GET /api/digital-id/verify/:token endpoint, which only ever
// returns name, role, issue date, and validity — never PII.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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

  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
        <p className="text-xs tracking-[0.3em] uppercase font-semibold text-purple-300 mb-4">FocusForge AI</p>

        {loading && <p className="text-sm text-gray-400">Checking ID card...</p>}

        {!loading && result?.valid && (
          <>
            <ShieldCheck className="mx-auto text-green-400 mb-3" size={40} />
            <h1 className="text-lg font-bold mb-1">Verified</h1>
            <p className="text-sm text-gray-300">{result.name}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{result.role}</p>
            <p className="text-xs text-gray-500">
              Card {result.cardNumber} · Issued {new Date(result.issuedAt).toLocaleDateString("en-IN")}
            </p>
          </>
        )}

        {!loading && result && !result.valid && (
          <>
            <ShieldX className="mx-auto text-red-400 mb-3" size={40} />
            <h1 className="text-lg font-bold mb-1">Not Valid</h1>
            <p className="text-sm text-gray-400">{result.error || "This ID could not be verified."}</p>
          </>
        )}
      </div>
    </div>
  );
}
