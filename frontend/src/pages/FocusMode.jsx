import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { Camera, Play, Pause, RotateCcw, Timer } from "lucide-react";

// ---------------------------------------------------------
// FocusMode Page
// Full-page version of the dashboard's "Focus Mode (Camera)"
// card. Turns on the webcam, lets the user start/pause a
// focus session, tracks session time, and shows a basic
// focus/distraction status.
//
// NOTE: Just like FocusTracker.jsx, `isFocused` here is a
// placeholder until the real AI model from
// ai-engine/focus-detection is wired in. Replace the
// placeholder logic (marked below) once that's ready.
// ---------------------------------------------------------

const API_BASE = "http://localhost:5000/api";

const SUBJECTS = ["Python", "DSA", "ML / AI", "Projects", "Revision"];

function formatTime(totalSeconds) {
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function FocusMode() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [error, setError] = useState(null);
  const [isFocused, setIsFocused] = useState(true); // placeholder until AI model is connected

  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [isSessionRunning, setIsSessionRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [focusedSeconds, setFocusedSeconds] = useState(0);
  const [distractions, setDistractions] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  // Start camera once on mount
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

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Session timer
  useEffect(() => {
    if (!isSessionRunning) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
      if (isFocused) {
        setFocusedSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isSessionRunning, isFocused]);

  // Placeholder distraction simulation — remove once real
  // AI focus-detection model is connected. It randomly
  // toggles focus state so the UI has something to show.
  useEffect(() => {
    if (!isSessionRunning) return;
    const interval = setInterval(() => {
      setIsFocused((prev) => {
        const next = Math.random() > 0.15; // mostly focused
        if (prev && !next) {
          setDistractions((d) => d + 1);
        }
        return next;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [isSessionRunning]);

  const focusPercent =
    seconds > 0 ? Math.round((focusedSeconds / seconds) * 100) : 100;

  function handleStartPause() {
    if (!isSessionRunning && seconds === 0) {
      // Starting a brand new session
      setSessionStartedAt(new Date().toISOString());
    }
    setIsSessionRunning((prev) => !prev);
  }

  // Save the session to the backend, then clear the stats
  async function handleReset() {
    setIsSessionRunning(false);

    if (seconds > 0) {
      try {
        const res = await fetch(`${API_BASE}/focus`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            startedAt: sessionStartedAt,
            durationSec: seconds,
            focusScore: focusPercent,
            distractions,
            subject,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to save session");
        }
        setSaveMessage("Session saved ✅");
        setSaveError("");
      } catch (err) {
        setSaveError(err.message || "Failed to save session");
      }
    }

    setSeconds(0);
    setFocusedSeconds(0);
    setDistractions(0);
    setSessionStartedAt(null);
  }

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <TopBar userName={user?.name} streak={12} level={8} />

        <div className="px-6 mt-4 flex flex-col gap-4">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Camera className="text-purple-400" size={20} />
              Focus Mode
            </h1>
            <p className="text-sm text-gray-400">
              Stay on camera while you study. We'll track how focused you are
              during this session.
            </p>
          </div>

          {saveMessage && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-xl px-4 py-2">
              {saveMessage}
            </div>
          )}
          {saveError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-2">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Camera panel */}
            <section className="lg:col-span-2 bg-[#13131f] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Live Camera</h2>
                {isCameraOn && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-400" />{" "}
                    Live
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
                  className={`mt-3 text-sm text-center ${
                    isFocused ? "text-green-400" : "text-orange-400"
                  }`}
                >
                  {isFocused
                    ? "You are in focus zone ✅"
                    : "Distraction detected ⚠️"}
                </p>
              )}

              {/* Subject selector */}
              <div className="mt-4">
                <label className="text-xs text-gray-400 mb-1 block">
                  Studying subject
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isSessionRunning || seconds > 0}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-purple-500 disabled:opacity-50"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Session controls */}
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={handleStartPause}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 transition-colors text-white px-5 py-2 rounded-xl text-sm font-medium"
                >
                  {isSessionRunning ? (
                    <>
                      <Pause size={16} /> Pause Session
                    </>
                  ) : (
                    <>
                      <Play size={16} /> Start Session
                    </>
                  )}
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 border border-white/10 hover:bg-white/5 transition-colors px-4 py-2 rounded-xl text-sm text-gray-300"
                >
                  <RotateCcw size={16} /> End & Save Session
                </button>
              </div>
            </section>

            {/* Stats panel */}
            <section className="lg:col-span-1 bg-[#13131f] rounded-2xl p-4 border border-white/5 flex flex-col gap-4">
              <h2 className="font-semibold">Session Stats</h2>

              <div className="bg-[#0e0e18] rounded-xl p-4 border border-white/5">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Timer size={14} /> Session Time
                </div>
                <p className="text-2xl font-bold text-purple-300">
                  {formatTime(seconds)}
                </p>
              </div>

              <div className="bg-[#0e0e18] rounded-xl p-4 border border-white/5">
                <p className="text-xs text-gray-400 mb-1">Focus Score</p>
                <p className="text-2xl font-bold text-green-400">
                  {focusPercent}%
                </p>
                <div className="w-full h-2 bg-white/5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${focusPercent}%` }}
                  />
                </div>
              </div>

              <div className="bg-[#0e0e18] rounded-xl p-4 border border-white/5">
                <p className="text-xs text-gray-400 mb-1">Distractions</p>
                <p className="text-2xl font-bold text-orange-400">
                  {distractions}
                </p>
              </div>

              <p className="text-xs text-gray-500 mt-auto">
                Note: focus/distraction detection is placeholder data for now.
                Real AI tracking will connect from ai-engine/focus-detection.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}