// ---------------------------------------------------------
// faceLandmarkDetector.js — thin wrapper around MediaPipe Tasks
// Vision's FaceLandmarker, running entirely in-browser via WASM.
//
// This is the browser equivalent of the Python PoC's
// `vision.FaceLandmarker.create_from_options(...)` — same
// underlying model (MODEL_URL is the identical asset the PoC
// downloaded), just the JS/WASM runtime instead of the desktop
// Python one. Nothing is sent to any server: detection happens
// entirely on the student's own device.
// ---------------------------------------------------------
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { MODEL_URL, WASM_BASE_URL } from "./constants";

let landmarkerPromise = null;

// The WASM runtime + ~4MB model download only needs to happen once
// per browser session — cached here so FocusMode.jsx and
// FocusTracker.jsx (if both mounted) share a single loaded model
// instead of each loading their own.
function loadFaceLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      return FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "VIDEO",
        numFaces: 3,
        minFaceDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })();
  }
  return landmarkerPromise;
}

/**
 * Lightweight lighting boost, applied before detection.
 *
 * NOT the same as the PoC's CLAHE (adaptive histogram equalization
 * via OpenCV) — true CLAHE needs an OpenCV.js/WASM dependency,
 * which is a heavy addition for an MVP. This is a cheap canvas
 * `filter` approximation (flat contrast + brightness boost) that
 * helps in dim rooms without the extra dependency. If low-light
 * accuracy turns out to matter a lot in practice, swapping this for
 * real CLAHE later is a contained change — only this function needs
 * to change, callers are unaffected.
 */
export function drawEnhancedFrame(videoEl, canvasEl) {
  const ctx = canvasEl.getContext("2d");
  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  ctx.filter = "contrast(1.15) brightness(1.12)";
  ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
  ctx.filter = "none";
}

/**
 * Runs detection on a single video frame.
 * @param {HTMLCanvasElement} canvasEl — the enhanced frame (see drawEnhancedFrame)
 * @param {number} timestampMs — must be monotonically increasing per model instance
 * @returns {Promise<Array>} array of faces, each an array of landmark points {x, y, z}
 */
export async function detectFaces(canvasEl, timestampMs) {
  const landmarker = await loadFaceLandmarker();
  const result = landmarker.detectForVideo(canvasEl, timestampMs);
  return result.faceLandmarks || [];
}
