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
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 pl-16 md:pl-6 border-b border-white/5">
      <div className="min-w-0">
        <h1 className="text-base md:text-lg font-semibold truncate">
          {getGreeting()}, {userName}! 👋
        </h1>
        <p className="hidden sm:block text-sm text-gray-400">
          Stay focused, stay consistent. Great things take time.
        </p>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-1 text-orange-400 text-xs md:text-sm font-medium whitespace-nowrap">
          🔥 {streak} <span className="hidden sm:inline text-gray-400 font-normal">Day Streak</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-purple-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
            {userName?.[0] ?? "U"}
          </div>
          <div className="hidden sm:block text-sm">
            <p className="font-medium leading-tight">{userName}</p>
            <p className="text-purple-400 text-xs leading-tight">Level {level}</p>
          </div>
        </div>
      </div>
    </header>
  );
}