import React from "react";
import { PlayCircle } from "lucide-react";

// Shows the task user is currently working on:
// title, description, progress bar, recommended video, sub-topics checklist
//
// UPDATED (additive only): if `timeLeft` is not provided (null/undefined),
// the top-right area shows a Priority badge instead, using the `priority`
// prop. If `timeLeft` IS provided, behavior is 100% unchanged from before.
export default function CurrentTask({
  title = "Python – Functions, Loops, OOP",
  description = "Learn in detail about functions, loops (for, while), and Object Oriented Programming basics.",
  timeLeft = "00:45:30",
  priority = null,
  progress = 60,
  subTopics = [
    { label: "Functions in Python", done: true },
    { label: "For Loop", done: true },
    { label: "While Loop", done: false },
    { label: "OOP Basics (Class, Object)", done: false },
  ],
  onStart,
}) {
  const priorityColors = {
    High: "text-red-400 bg-red-500/10 border-red-500/30",
    Medium: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    Low: "text-green-400 bg-green-500/10 border-green-500/30",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Current Task</h2>
        {timeLeft ? (
          <span className="text-xs text-gray-400">Time Left</span>
        ) : priority ? (
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${
              priorityColors[priority] || priorityColors.Medium
            }`}
          >
            {priority} Priority
          </span>
        ) : null}
      </div>

      {timeLeft && (
        <p className="text-xl font-bold text-purple-300 mb-3">{timeLeft}</p>
      )}

      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-gray-400 mt-1">{description}</p>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="w-full bg-white/5 rounded-full h-2">
          <div
            className="bg-purple-500 h-2 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{progress}% Completed</p>
      </div>

      {/* Sub topics checklist */}
      {subTopics.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Sub Topics</p>
          <ul className="space-y-1">
            {subTopics.map((topic) => (
              <li key={topic.label} className="flex items-center gap-2 text-sm">
                <span
                  className={`w-3 h-3 rounded-full border ${
                    topic.done
                      ? "bg-green-500 border-green-500"
                      : "border-gray-500"
                  }`}
                />
                <span className={topic.done ? "text-gray-300" : "text-gray-500"}>
                  {topic.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onStart}
        className="mt-auto pt-4 w-full bg-purple-600 hover:bg-purple-500 transition-colors rounded-xl py-2 flex items-center justify-center gap-2 text-sm font-medium"
      >
        <PlayCircle size={18} />
        Start / Resume Task
      </button>
    </div>
  );
}