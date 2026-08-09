// ---------------------------------------------------------
// useFocusDetection.js — React hook that runs the detection loop
// against a <video> element and exposes live focus state.
//
// Shared by both FocusMode.jsx (full session page) and
// FocusTracker.jsx (dashboard preview card) — same detection logic
// in one place rather than duplicated across both.
//
// Usage:
//   const { isFocused, isModelLoading, modelError, lastAlert } =
//     useFocusDetection(videoRef, { enabled: isCameraOn, onAlert });
// ---------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { detectFaces, drawEnhancedFrame } from "../lib/focusDetection/faceLandmarkDetector";
import { createFocusEvaluator } from "../lib/focusDetection/focusEvaluator";
import { DETECTION_INTERVAL_MS, ALERT_COOLDOWN_MS } from "../lib/focusDetection/constants";

export function useFocusDetection(videoRef, { enabled }) {
  const [isFocused, setIsFocused] = useState(true);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState(null);
  const [lastAlert, setLastAlert] = useState(null); // { type, detail, at } — most recent CONFIRMED alert

  const canvasRef = useRef(document.createElement("canvas"));
  const evaluatorRef = useRef(createFocusEvaluator());
  const lastAlertAtRef = useRef({}); // type -> timestamp ms, for cooldown
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      evaluatorRef.current.reset();
      setIsFocused(true);
      return;
    }

    let cancelled = false;
    setIsModelLoading(true);
    setModelError(null);

    async function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || video.readyState < 2 || cancelled) return; // not enough data yet

      try {
        drawEnhancedFrame(video, canvas);
        const faces = await detectFaces(canvas, performance.now());
        if (cancelled) return;

        const { isFocused: focusedNow, confirmedAlert } = evaluatorRef.current.evaluate(
          faces,
          canvas.width
        );
        setIsFocused(focusedNow);
        setIsModelLoading(false);

        if (confirmedAlert) {
          const now = Date.now();
          const lastFired = lastAlertAtRef.current[confirmedAlert.type] || 0;
          if (now - lastFired >= ALERT_COOLDOWN_MS) {
            lastAlertAtRef.current[confirmedAlert.type] = now;
            setLastAlert({ ...confirmedAlert, at: now });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setModelError(err.message || "Focus detection model failed to load.");
          setIsModelLoading(false);
        }
      }
    }

    // Run once immediately (so isModelLoading clears promptly),
    // then on the regular interval.
    tick();
    intervalRef.current = setInterval(tick, DETECTION_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, videoRef]);

  return { isFocused, isModelLoading, modelError, lastAlert };
}
