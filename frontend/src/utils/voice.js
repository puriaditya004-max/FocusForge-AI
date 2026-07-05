// ===========================================================
// Forge AI — Voice utilities
// ===========================================================
// Wraps the browser's built-in SpeechSynthesis (text -> voice)
// and SpeechRecognition (voice -> text) APIs.
// - Voice OUTPUT (speak) works in all modern browsers.
// - Voice INPUT (listening) needs a Chromium browser
//   (Chrome / Edge) — Firefox/Safari don't support it yet.
// No backend call, no API key — fully free, runs on-device.
// ===========================================================

export function getTimeBasedGreetingWords() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function buildSpokenGreeting(name) {
  const word = getTimeBasedGreetingWords();
  return `${word}, ${name || "there"}! Ready to forge today's focus?`;
}

// Speak any text aloud. Safe to call even if unsupported — no-ops instead of crashing.
export function speak(text, { rate = 1, pitch = 1, onEnd } = {}) {
  if (!("speechSynthesis" in window) || !text) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel(); // stop anything already speaking
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = rate;
  utter.pitch = pitch;
  utter.onend = () => onEnd?.();
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function isVoiceInputSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// One-shot voice listener — student speaks once, we get the transcript.
export function listenOnce({ onResult, onError, onEnd, lang = "en-IN" } = {}) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError?.(new Error("Voice input isn't supported in this browser. Try Chrome or Edge."));
    onEnd?.();
    return null;
  }

  const recognizer = new SpeechRecognition();
  recognizer.lang = lang;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;

  recognizer.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    onResult?.(transcript);
  };
  recognizer.onerror = (event) => {
    onError?.(new Error(event.error || "Voice input failed"));
  };
  recognizer.onend = () => {
    onEnd?.();
  };

  recognizer.start();
  return recognizer; // caller can call .stop() to cancel early
}

// ---------------------------------------------------------
// Continuous listener — keeps listening indefinitely (for the
// "Hey Forge" style always-on widget). Browsers auto-stop
// SpeechRecognition after a period of silence even in
// continuous mode, so this auto-restarts it until the caller
// explicitly calls .stop().
//
// NOTE: this is real speech-to-text running continuously, not
// a low-power dedicated "wake word" engine — it needs an open
// tab, a granted mic permission, and only works reliably in
// Chrome/Edge.
// ---------------------------------------------------------
export function startContinuousListening({ onTranscript, onError, lang = "en-IN" } = {}) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError?.(new Error("Voice input isn't supported in this browser. Try Chrome or Edge."));
    return null;
  }

  const recognizer = new SpeechRecognition();
  recognizer.lang = lang;
  recognizer.continuous = true;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;

  let manuallyStopped = false;

  recognizer.onresult = (event) => {
    const last = event.results[event.results.length - 1];
    const transcript = last?.[0]?.transcript;
    if (transcript) onTranscript?.(transcript.trim());
  };

  recognizer.onerror = (event) => {
    if (event.error !== "no-speech" && event.error !== "aborted") {
      onError?.(new Error(event.error || "Voice input failed"));
    }
  };

  recognizer.onend = () => {
    if (!manuallyStopped) {
      try {
        recognizer.start();
      } catch {
        // already running / starting — safe to ignore
      }
    }
  };

  try {
    recognizer.start();
  } catch {
    // ignore double-start races
  }

  return {
    stop: () => {
      manuallyStopped = true;
      try {
        recognizer.stop();
      } catch {
        // already stopped
      }
    },
  };
}