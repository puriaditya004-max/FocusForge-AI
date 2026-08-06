import React, { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Mic, MicOff, Sparkles, X, CheckCircle2 } from "lucide-react";
import { speak, stopSpeaking, isVoiceInputSupported, listenOnce } from "../utils/voice";

// ---------------------------------------------------------
// "Hey Forge" — global floating voice widget.
// Lives on every student page (mounted once in App.jsx).
// Tap the mic, speak naturally:
//   - "Set my day study routine on Python" -> creates real
//     Task rows via POST /api/mentor/voice-command, which the
//     student will immediately see in Today's Plan.
//   - Anything else -> just a normal spoken conversation reply.
// Self-contained: doesn't touch any existing page's code.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function HeyForgeWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [tasksCreated, setTasksCreated] = useState(0);
  const [error, setError] = useState("");
  const voiceSupported = isVoiceInputSupported();
  const closeTimerRef = useRef(null);

  function clearAutoClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleAutoClose() {
    clearAutoClose();
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 8000);
  }

  function handleMicClick() {
    if (isListening || isThinking) return;
    if (!voiceSupported) {
      setError("Voice isn't supported in this browser. Try Chrome or Edge.");
      setIsOpen(true);
      return;
    }

    clearAutoClose();
    setIsOpen(true);
    setError("");
    setLastReply("");
    setTasksCreated(0);
    setIsListening(true);

    listenOnce({
      onResult: (transcript) => {
        setLastTranscript(transcript);
        sendToForge(transcript);
      },
      onError: (err) => {
        setError(err.message || "Didn't catch that, try again.");
        scheduleAutoClose();
      },
      onEnd: () => setIsListening(false),
    });
  }

  async function sendToForge(transcript) {
    setIsThinking(true);
    try {
      const res = await fetch(`${API_BASE}/mentor/voice-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Forge couldn't process that.");

      setLastReply(data.reply);
      setTasksCreated(data.tasksCreated || 0);
      speak(data.reply, { onEnd: scheduleAutoClose });
    } catch (err) {
      setError(err.message);
      scheduleAutoClose();
    } finally {
      setIsThinking(false);
    }
  }

  function handleClose() {
    stopSpeaking();
    clearAutoClose();
    setIsOpen(false);
  }

  // Only shown for logged-in STUDENT users — voice tasks land in
  // the student's own Today's Plan, so this widget wouldn't make
  // sense for Parent/Teacher accounts.
  if (!user || user.role !== "STUDENT") return null;

  return (
    <>
      {/* Response bubble */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-72 bg-[#13131f] border border-white/10 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center">
                <Sparkles size={13} className="text-purple-200" />
              </div>
              <p className="text-sm font-medium">Hey Forge</p>
            </div>
            <button onClick={handleClose} className="text-gray-500 hover:text-gray-200">
              <X size={15} />
            </button>
          </div>

          {isListening && (
            <p className="text-sm text-purple-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" /> Listening...
            </p>
          )}

          {isThinking && (
            <p className="text-sm text-gray-400">Thinking...</p>
          )}

          {!isListening && !isThinking && lastTranscript && (
            <p className="text-xs text-gray-500 mb-2 italic">"{lastTranscript}"</p>
          )}

          {!isListening && !isThinking && lastReply && (
            <p className="text-sm text-gray-200 leading-relaxed">{lastReply}</p>
          )}

          {tasksCreated > 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-green-400">
              <CheckCircle2 size={13} />
              {tasksCreated} task{tasksCreated > 1 ? "s" : ""} added to Today's Plan
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      {/* Floating mic button */}
      <button
        onClick={handleMicClick}
        disabled={isListening || isThinking}
        title="Hey Forge — tap and speak"
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all ${
          isListening
            ? "bg-red-600 animate-pulse"
            : isThinking
            ? "bg-purple-800"
            : "bg-purple-600 hover:bg-purple-700 hover:scale-105"
        }`}
      >
        {isListening ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
      </button>
    </>
  );
}