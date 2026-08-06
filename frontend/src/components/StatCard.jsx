import React from "react";

// Small reusable card used in the stats row at the top of Dashboard
export default function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
    </div>
  );
}