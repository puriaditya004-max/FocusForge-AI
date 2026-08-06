// ---------------------------------------------------------
// Shared Today's Tasks data
// Single source of truth for "today's plan" so multiple pages
// (TodaysPlan, YoutubeSuggestions, Dashboard, etc.) read the
// same data instead of each keeping their own hardcoded copy.
// Once backend is connected, replace this static array with
// an API fetch that returns the same shape.
// ---------------------------------------------------------

export const todaysTasks = [
  {
    id: 1,
    title: "Wake Up & Fresh",
    subject: "Routine",
    time: "06:00 AM",
    duration: "60 min",
    priority: "Low",
    completed: true,
    subtasks: [],
  },
  {
    id: 2,
    title: "Revision – Yesterday's Topics",
    subject: "Python",
    time: "07:00 AM",
    duration: "60 min",
    priority: "Medium",
    completed: true,
    subtasks: [],
  },
  {
    id: 3,
    title: "Python – Setup, Syntax, Variables, Data Types",
    subject: "Python",
    time: "08:00 AM",
    duration: "2 hrs",
    priority: "High",
    completed: false,
    subtasks: [
      { id: 31, title: "Install Python + VS Code", done: true },
      { id: 32, title: "Syntax, print(), comments", done: true },
      { id: 33, title: "Variables & Data Types (int, float, str, bool)", done: false },
      { id: 34, title: "Type conversion practice", done: false },
    ],
  },
  {
    id: 4,
    title: "Operators & Input/Output",
    subject: "Python",
    time: "10:30 AM",
    duration: "2 hrs",
    priority: "Medium",
    completed: false,
    subtasks: [
      { id: 41, title: "Arithmetic & comparison operators", done: false },
      { id: 42, title: "Logical & assignment operators", done: false },
      { id: 43, title: "input() and formatted output", done: false },
    ],
  },
  {
    id: 5,
    title: "Weekly Project – Simple Calculator",
    subject: "Project",
    time: "01:30 PM",
    duration: "2 hrs",
    priority: "High",
    completed: false,
    subtasks: [
      { id: 51, title: "Build basic calculator (+, -, *, /)", done: false },
      { id: 52, title: "Add input validation", done: false },
    ],
  },
];

// Returns the task that should currently be in focus:
// first incomplete task in list order. Falls back to the
// last task if everything is completed.
export function getCurrentTask(tasks = todaysTasks) {
  return tasks.find((t) => !t.completed) ?? tasks[tasks.length - 1];
}