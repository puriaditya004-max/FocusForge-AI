// ---------------------------------------------------------
// constants.js — detection thresholds.
//
// These exact values are ported from the Python PoC
// (modules/vigil-exam/backend/poc_face_tracker.py, v5) rather than
// picked fresh — they were already hand-tuned there against a real
// webcam, so reusing them skips a round of manual trial-and-error
// here. If real usage data later shows these are too strict/loose
// for FocusForge's self-study context (vs. the PoC's exam-proctoring
// context), tune here — every consumer of this module reads from
// here, nothing is hardcoded elsewhere.
// ---------------------------------------------------------

export const NO_FACE_PERSIST_SECONDS = 3.0;
export const HEAD_TURN_PERSIST_SECONDS = 1.2;
export const MULTI_FACE_PERSIST_SECONDS = 0.6;
export const HEAD_TURN_OFFSET_RATIO = 0.15;

// How many consecutive detection ticks a condition is allowed to
// "miss" before its persistence timer resets — absorbs motion blur,
// a blink, or one bad frame instead of treating it as the condition
// having genuinely ended. Same flicker-resilience idea as the PoC.
export const GRACE_TICKS = 5;

// How often we actually run detection (ms). The PoC ran on every
// captured video frame (~30fps) because that cost nothing extra on
// a local Python process; in a browser tab this runs on the main
// thread's WASM binding, so ticking every ~400ms is deliberately
// gentler on battery/CPU while still comfortably fast enough for
// human head-turn timescales (nobody turns their head in <400ms and
// back before the persistence window even starts counting).
export const DETECTION_INTERVAL_MS = 400;

// Minimum gap between raising the same alert type again, so a
// student who keeps drifting in and out of frame doesn't rack up a
// distraction count of 40 in one session for what's really one
// ongoing lapse.
export const ALERT_COOLDOWN_MS = 5000;

export const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
