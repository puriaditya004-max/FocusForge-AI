import React, { useEffect, useState } from "react";
import { UserCheck, X, Check } from "lucide-react";

// ---------------------------------------------------------
// ParentRequestBanner
// Shows any PENDING parent-link requests for the logged-in
// student, with Approve / Reject actions. This is the actual
// consent step — a parent can no longer see a student's data
// just by knowing their email; the student has to say yes here.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function ParentRequestBanner() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    try {
      const res = await fetch(`${API_BASE}/parent/requests/pending`, {
        credentials: "include",
      });
      if (!res.ok) return; // fail silently — this is a non-critical banner
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      // non-critical — don't block the dashboard on this
    } finally {
      setLoading(false);
    }
  }

  async function respond(id, approve) {
    setRespondingId(id);
    try {
      const res = await fetch(`${API_BASE}/parent/requests/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ approve }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {
      // if it fails, request just stays in the list — user can retry
    } finally {
      setRespondingId(null);
    }
  }

  if (loading || requests.length === 0) return null;

  return (
    <div className="mx-6 mt-4 flex flex-col gap-2">
      {requests.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <UserCheck size={18} className="text-purple-300 shrink-0" />
            <p className="text-sm text-gray-200">
              <span className="font-medium">{r.parentName}</span>{" "}
              <span className="text-gray-400">({r.parentEmail})</span> wants to link as your
              parent and view your progress. They will not see anything unless you approve.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              disabled={respondingId === r.id}
              onClick={() => respond(r.id, true)}
              className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg px-3 py-1.5 transition-colors"
            >
              <Check size={13} /> Approve
            </button>
            <button
              disabled={respondingId === r.id}
              onClick={() => respond(r.id, false)}
              className="flex items-center gap-1 text-xs bg-white/5 hover:bg-white/10 disabled:opacity-60 text-gray-300 rounded-lg px-3 py-1.5 border border-white/10 transition-colors"
            >
              <X size={13} /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
