// ---------------------------------------------------------
// focusEvaluator.js — takes raw face landmarks for one detection
// tick and decides: is the student focused right now, and has any
// condition (NO_FACE / HEAD_TURNED / MULTIPLE_FACES) just been
// CONFIRMED (crossed its persistence threshold)?
//
// Landmark index 1 = nose tip in MediaPipe's face mesh — same index
// the Python PoC used for its head-turn offset check.
// ---------------------------------------------------------
import { createPersistenceTracker } from "./persistenceTracker";
import {
  NO_FACE_PERSIST_SECONDS,
  HEAD_TURN_PERSIST_SECONDS,
  MULTI_FACE_PERSIST_SECONDS,
  HEAD_TURN_OFFSET_RATIO,
} from "./constants";

const NOSE_TIP_INDEX = 1;

export function createFocusEvaluator() {
  const trackers = {
    NO_FACE: createPersistenceTracker(),
    HEAD_TURNED: createPersistenceTracker(),
    MULTIPLE_FACES: createPersistenceTracker(),
  };

  /**
   * @param {Array} faces — result of detectFaces(); [] if none found
   * @param {number} frameWidth
   * @returns {{
   *   isFocused: boolean,
   *   confirmedAlert: { type: string, detail: string } | null
   * }}
   */
  function evaluate(faces, frameWidth) {
    if (!faces || faces.length === 0) {
      const { confirmed, elapsedSeconds } = trackers.NO_FACE.check(true, NO_FACE_PERSIST_SECONDS);
      trackers.HEAD_TURNED.check(false, HEAD_TURN_PERSIST_SECONDS);
      trackers.MULTIPLE_FACES.check(false, MULTI_FACE_PERSIST_SECONDS);

      return {
        isFocused: !confirmed,
        confirmedAlert: confirmed
          ? { type: "NO_FACE", detail: `absent_for=${elapsedSeconds.toFixed(1)}s` }
          : null,
      };
    }

    // Face(s) present — NO_FACE condition is no longer active
    // (still runs through the tracker so its grace/miss logic stays
    // consistent rather than hard-resetting).
    trackers.NO_FACE.check(false, NO_FACE_PERSIST_SECONDS);

    const multiFaceResult = trackers.MULTIPLE_FACES.check(
      faces.length > 1,
      MULTI_FACE_PERSIST_SECONDS
    );

    let headTurnedNow = false;
    for (const face of faces) {
      const noseTip = face[NOSE_TIP_INDEX];
      if (!noseTip) continue;
      const noseX = noseTip.x * frameWidth;
      const offset = noseX - frameWidth / 2;
      if (Math.abs(offset) > frameWidth * HEAD_TURN_OFFSET_RATIO) {
        headTurnedNow = true;
      }
    }
    const headTurnResult = trackers.HEAD_TURNED.check(headTurnedNow, HEAD_TURN_PERSIST_SECONDS);

    if (multiFaceResult.confirmed) {
      return {
        isFocused: false,
        confirmedAlert: {
          type: "MULTIPLE_FACES",
          detail: `${faces.length} faces in frame`,
        },
      };
    }
    if (headTurnResult.confirmed) {
      return {
        isFocused: false,
        confirmedAlert: {
          type: "HEAD_TURNED",
          detail: `sustained_offset persisted ${headTurnResult.elapsedSeconds.toFixed(1)}s`,
        },
      };
    }

    return { isFocused: true, confirmedAlert: null };
  }

  function reset() {
    trackers.NO_FACE.reset();
    trackers.HEAD_TURNED.reset();
    trackers.MULTIPLE_FACES.reset();
  }

  return { evaluate, reset };
}
