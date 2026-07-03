import React, { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------
// FocusTracker
// Turns on the user's webcam and shows a live preview inside
// a card, similar to the "Focus Mode (Camera)" box in the
// dashboard design.
//
// NOTE: This file only handles the CAMERA UI (getting video
// from the webcam and displaying it). The actual AI model
// that detects whether the user is focused or distracted
// will be plugged in later inside ai-engine/focus-detection.
// For now `isFocused` is a placeholder state you can wire up
// once that model is ready.
// ---------------------------------------------------------

export default function FocusTracker() {
  const videoRef = useRef(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [error, setError] = useState(null);
  const [isFocused, setIsFocused] = useState(true); // placeholder until AI model is connected

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
            isFocused ? "text-green-400" : "text-orange-400"
          }`}
        >
          {isFocused ? "You are in focus zone ✅" : "Distraction detected ⚠️"}
        </p>
      )}
    </div>
  );
}