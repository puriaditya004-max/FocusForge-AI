import React, { useEffect, useRef, useState } from "react";
import { useFocusDetection } from "../hooks/useFocusDetection";

// ---------------------------------------------------------
// FocusTracker
// Turns on the user's webcam and shows a live preview inside
// a card, similar to the "Focus Mode (Camera)" box in the
// dashboard design.
//
// isFocused comes from useFocusDetection (MediaPipe FaceLandmarker
// running in-browser — see src/lib/focusDetection/). This is a
// lightweight preview card (no session/distraction tracking, no
// backend calls) -- the full session experience with saved stats
// lives in pages/FocusMode.jsx, which uses the same hook.
// ---------------------------------------------------------

export default function FocusTracker() {
  const videoRef = useRef(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [error, setError] = useState(null);

  const { isFocused, isModelLoading } = useFocusDetection(videoRef, {
    enabled: isCameraOn && !error,
  });

  useEffect(() => {
    let stream;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraOn(true);
      } catch (err) {
        setError("Camera access denied or unavailable.");
      }
    }

    startCamera();

    // Stop the camera when the component unmounts
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Focus Mode (Camera)</h2>
        {isCameraOn && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400" /> Live
          </span>
        )}
      </div>

      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        {error ? (
          <div className="w-full h-full flex items-center justify-center text-sm text-gray-400 px-4 text-center">
            {error}
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {isCameraOn && !error && (
        <p
          className={`mt-2 text-sm text-center ${
            isModelLoading ? "text-gray-400" : isFocused ? "text-green-400" : "text-orange-400"
          }`}
        >
          {isModelLoading
            ? "Loading focus detection model…"
            : isFocused
            ? "You are in focus zone ✅"
            : "Distraction detected ⚠️"}
        </p>
      )}
    </div>
  );
}
