// ---------------------------------------------------------
// utils/aiSafety.js — backstop check on AI-generated replies
// before they reach a student.
//
// This app is used by school students, and (per the age-gating
// added earlier) some of them ARE minors. Right now, whatever the
// AI Mentor generates — Gemini or a student's own BYOK Claude key
// — goes straight from the model to the database to the student's
// screen with zero server-side check in between.
//
// Two layers of defense, not one:
//   1. Gemini's own `safetySettings` (set in mentor.controller.js's
//      callGemini) is the PRIMARY layer — a real content classifier,
//      free, built into the API call itself, blocks before a reply
//      even comes back.
//   2. THIS file is the backstop — a lightweight, provider-agnostic
//      keyword/pattern scan that runs on every reply regardless of
//      which model produced it (covers the BYOK Claude path, which
//      never goes through Gemini's classifier, and catches anything
//      that slips past layer 1).
//
// Deliberately blunt and pattern-level, not a full ML classifier —
// same design choice as the existing Study Room moderation.js:
// false negatives here are safer to accept than false positives
// blocking a genuine, harmless study answer.
// ---------------------------------------------------------

// Categories that matter specifically for an AI STUDY MENTOR talking
// to students (different concern than the Study Room's profanity
// filter): content that encourages self-harm, sexual content, or
// instructions for serious real-world harm. Kept short and pattern-
// level on purpose — see the file header.
const UNSAFE_PATTERNS = [
  // Self-harm encouragement/method content — never appropriate from
  // a study mentor, regardless of how the conversation got there.
  /\b(kill yourself|kys|how to (commit|attempt) suicide|ways? to (end|hurt) (my|your|his|her) ?self)\b/i,
  // Sexual content involving minors — zero tolerance, no exceptions,
  // regardless of framing.
  /\b(child|minor|kid|underage)\b[^.]{0,60}\b(sex|sexual|nude|naked)\b/i,
  // Explicit weapon/explosive construction instructions.
  /\b(how to (make|build|synthesize)) (a )?(bomb|explosive|weapon)\b/i,
];

/**
 * @param {string} text — the AI's generated reply, before it's saved
 *   or sent to the student.
 * @returns {boolean} true if the reply should be BLOCKED and replaced
 *   with SAFE_FALLBACK_REPLY instead of shown as-is.
 */
function isUnsafeAiOutput(text) {
  const normalized = String(text || "");
  return UNSAFE_PATTERNS.some((pattern) => pattern.test(normalized));
}

const SAFE_FALLBACK_REPLY =
  "I'm not able to help with that one. Let's get back to your studies — what topic are you working on?";

module.exports = { isUnsafeAiOutput, SAFE_FALLBACK_REPLY };
