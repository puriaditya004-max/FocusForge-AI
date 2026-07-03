import React from "react";

// Top header bar: greeting, streak counter, profile
export default function TopBar({ userName = "Friend", streak = 0, level = 1 }) {
  // Time-based greeting — Morning / Afternoon / Evening / Night
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    if (hour < 21) return "Good Evening";
    return "Good Night";
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
      <div>
        <h1 className="text-lg font-semibold">
          {getGreeting()}, {userName}! 👋
        </h1>
        <p className="text-sm text-gray-400">
          Stay focused, stay consistent. Great things take time.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 text-orange-400 text-sm font-medium">
          🔥 {streak} <span className="text-gray-400 font-normal">Day Streak</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-purple-700 flex items-center justify-center text-sm font-semibold">
            {userName?.[0] ?? "U"}
          </div>
          <div className="text-sm">
            <p className="font-medium leading-tight">{userName}</p>
            <p className="text-purple-400 text-xs leading-tight">Level {level}</p>
          </div>
        </div>
      </div>
    </header>
  );
}