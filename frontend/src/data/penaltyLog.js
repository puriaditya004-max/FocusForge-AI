// ---------------------------------------------------------
// penaltyLog.js — Shared Penalty Data Source
// Used by: pages/Penalties.jsx (now)
// Will also be used by: Parents Panel (future, backend phase)
//   -> Parent Panel will read the SAME shape of data via API
//   -> Keep this file as the single source of truth so nothing
//      needs to be duplicated when backend is connected.
// ---------------------------------------------------------

// Severity ladder: yellow (1st) -> orange (2nd) -> red (3rd+)
// This resets weekly in the real system (backend will handle reset).

export const penaltyEvents = [
  {
    id: 1,
    date: "2025-01-10",
    type: "missed_task",
    title: "Missed: Python – Loops practice",
    severity: "yellow",
    xpDeducted: 0,
    resolved: true,
    redemptionDone: true,
  },
  {
    id: 2,
    date: "2025-01-12",
    type: "low_focus",
    title: "Focus score dropped to 42% during Study Room session",
    severity: "yellow",
    xpDeducted: 10,
    resolved: true,
    redemptionDone: false,
  },
  {
    id: 3,
    date: "2025-01-15",
    type: "missed_task",
    title: "Missed: Revision – Week 2 recap",
    severity: "orange",
    xpDeducted: 30,
    resolved: false,
    redemptionDone: false,
  },
  {
    id: 4,
    date: "2025-01-18",
    type: "streak_break",
    title: "0 tasks completed — streak broken (was 9 days)",
    severity: "red",
    xpDeducted: 50,
    resolved: false,
    redemptionDone: false,
  },
];

// Current active strike count (resets weekly — backend will handle actual reset logic)
export function getCurrentStrikeLevel() {
  const unresolved = penaltyEvents.filter((e) => !e.resolved);
  if (unresolved.some((e) => e.severity === "red")) return "red";
  if (unresolved.some((e) => e.severity === "orange")) return "orange";
  if (unresolved.some((e) => e.severity === "yellow")) return "yellow";
  return "none";
}

export function getStrikeCount() {
  return penaltyEvents.filter((e) => !e.resolved).length;
}

export function getTotalXpDeducted() {
  return penaltyEvents.reduce((sum, e) => sum + e.xpDeducted, 0);
}

// ---------------------------------------------------------
// PARENT PANEL HOOK (future use)
// When backend is connected, expose an aggregated weekly summary
// like this so the Parent Dashboard can render it directly without
// recalculating anything on its own:
//
// export function getWeeklySummaryForParent() {
//   return {
//     totalMissedTasks: ...,
//     redStrikes: ...,
//     xpLost: ...,
//     trend: "improving" | "worsening" | "same",
//   };
// }
// ---------------------------------------------------------

export const redemptionChallenges = [
  {
    id: 1,
    title: "Complete tomorrow's full task list with 90%+ focus score",
    reward: "Clears 1 penalty + refunds 20 XP",
    forSeverity: "orange",
  },
  {
    id: 2,
    title: "Study 3 days in a row without missing a single task",
    reward: "Clears streak_break penalty + restores partial streak",
    forSeverity: "red",
  },
];