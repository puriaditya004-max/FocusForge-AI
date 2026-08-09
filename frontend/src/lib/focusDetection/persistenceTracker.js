// ---------------------------------------------------------
// persistenceTracker.js — 1:1 port of `check_persistent_with_grace`
// from the Python PoC (poc_face_tracker.py). Same algorithm, same
// reasoning: a condition (no face / head turned / multiple faces)
// only gets CONFIRMED once it's been continuously true for a
// persistence window — and a single missed tick (motion blur, a
// blink, a momentary bad frame) doesn't reset that timer, so long
// as it doesn't miss GRACE_TICKS times in a row.
//
// One tracker instance per condition type (NO_FACE / HEAD_TURNED /
// MULTIPLE_FACES) — see useFocusDetection.js for how the three are
// wired up together.
// ---------------------------------------------------------
import { GRACE_TICKS } from "./constants";

export function createPersistenceTracker() {
  let conditionStartedAt = null;
  let missStreak = 0;

  /**
   * @param {boolean} isActiveNow — is the condition true this tick?
   * @param {number} persistSeconds — how long it must stay true to confirm
   * @returns {{ confirmed: boolean, elapsedSeconds: number }}
   */
  function check(isActiveNow, persistSeconds) {
    const now = Date.now();

    if (isActiveNow) {
      missStreak = 0;
      if (conditionStartedAt === null) {
        conditionStartedAt = now;
      }
      const elapsedSeconds = (now - conditionStartedAt) / 1000;
      return { confirmed: elapsedSeconds >= persistSeconds, elapsedSeconds };
    }

    if (conditionStartedAt !== null) {
      missStreak += 1;
      if (missStreak < GRACE_TICKS) {
        // Still in the grace window — keep the timer alive, don't
        // reset, but this tick itself doesn't count as "active".
        const elapsedSeconds = (now - conditionStartedAt) / 1000;
        return { confirmed: elapsedSeconds >= persistSeconds, elapsedSeconds };
      }
      // Grace exhausted — the condition genuinely ended.
      conditionStartedAt = null;
      missStreak = 0;
    }

    return { confirmed: false, elapsedSeconds: 0 };
  }

  function reset() {
    conditionStartedAt = null;
    missStreak = 0;
  }

  return { check, reset };
}
