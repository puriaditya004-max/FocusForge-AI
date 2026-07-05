import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import {
  Bot,
  Send,
  Sparkles,
  Lightbulb,
  TrendingUp,
  AlertCircle,
  Target,
  RefreshCw,
  History,
  Plus,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Paperclip,
  X,
  FileText,
  Brain,
  ArrowUpRight,
} from "lucide-react";
import {
  buildSpokenGreeting,
  speak,
  stopSpeaking,
  isVoiceInputSupported,
  listenOnce,
} from "../utils/voice";

// ---------------------------------------------------------
// AI Mentor Page — Forge AI Assistant
// v3: Doubt mode now supports attaching a photo or PDF of
// the actual question (textbook page, handwritten notes) —
// Forge AI reads it directly, no need to type it all out.
// v4: Weakness Detector card — real weak topics from actual
// ExamAttempt scores + FocusSession focus scores, with a
// one-click "Ask Forge to explain this" that jumps straight
// into Doubt mode for that exact topic.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const MAX_FILE_MB = 6;

const MODES = [
  { id: "chat", label: "Chat" },
  { id: "doubt", label: "Doubt" },
  { id: "planner", label: "Plan" },
];

const quickPromptsByMode = {
  chat: ["I'm losing motivation", "Review my this week's progress"],
  doubt: ["Explain OOP in simple terms", "What's the difference between a list and a tuple?"],
  planner: ["What should I study today?", "Plan my next 3 days"],
};

const insightIconMap = {
  positive: { icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10" },
  warning: { icon: AlertCircle, color: "text-orange-400", bg: "bg-orange-400/10" },
  milestone: { icon: Target, color: "text-purple-300", bg: "bg-purple-400/10" },
};

function getTimeBasedGreeting(name) {
  const hour = new Date().getHours();
  let greetingWord = "Hello";
  if (hour < 12) greetingWord = "Good morning";
  else if (hour < 17) greetingWord = "Good afternoon";
  else greetingWord = "Good evening";

  return `${greetingWord}, ${name} 👋 I'm Forge AI, your mentor. I can help you plan your day, explain tricky topics (even from a photo of your textbook), or just keep you motivated. What's on your mind?`;
}

function formatTime(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function buildFreshGreeting(name) {
  return [{ id: "greeting", role: "mentor", text: getTimeBasedGreeting(name), time: formatTime() }];
}

// Reads a File as base64 (without the "data:mime;base64," prefix)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // "data:image/png;base64,AAAA..."
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AiMentor() {
  const { user } = useAuth();
  const userName = user?.name || "Student";

  const [messages, setMessages] = useState(() => buildFreshGreeting(userName));
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [viewMode, setViewMode] = useState("new");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [mode, setMode] = useState("chat");

  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(true);

  const [isListening, setIsListening] = useState(false);
  const [voiceReplyOn, setVoiceReplyOn] = useState(true);
  const voiceSupported = isVoiceInputSupported();
  const hasSpokenGreeting = useRef(false);

  // Doubt Solver: attached photo/PDF
  const [attachedFile, setAttachedFile] = useState(null); // { name, mimeType, dataBase64, previewUrl }
  const [attachError, setAttachError] = useState("");
  const fileInputRef = useRef(null);

  // Weakness Detector: real data from ExamAttempt + FocusSession
  const [weaknessReport, setWeaknessReport] = useState(null);
  const [weaknessLoading, setWeaknessLoading] = useState(true);

  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    loadRecommendations();
    loadWeaknessReport();
  }, []);

  useEffect(() => {
    if (!hasSpokenGreeting.current && voiceReplyOn) {
      hasSpokenGreeting.current = true;
      speak(buildSpokenGreeting(userName));
    }
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRecommendations() {
    setInsightsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mentor/recommendations`, { credentials: "include" });
      const data = await res.json();
      setInsights(data.results || []);
    } catch (err) {
      console.error("Failed to load recommendations:", err);
      setInsights([]);
    } finally {
      setInsightsLoading(false);
    }
  }

  async function loadWeaknessReport() {
    setWeaknessLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mentor/weakness-report`, { credentials: "include" });
      const data = await res.json();
      setWeaknessReport(data);
    } catch (err) {
      console.error("Failed to load weakness report:", err);
      setWeaknessReport(null);
    } finally {
      setWeaknessLoading(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mentor/history`, { method: "GET", credentials: "include" });
      const data = await res.json();
      const results = data.results || [];
      setMessages(results.length === 0 ? buildFreshGreeting(userName) : results);
      setViewMode("history");
    } catch (err) {
      console.error("Failed to load mentor history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }

  function startNewChat() {
    setMessages(buildFreshGreeting(userName));
    setViewMode("new");
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setAttachError("");

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setAttachError("Only PNG, JPG, WEBP images or PDF files are supported.");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setAttachError(`File is too large — please attach something under ${MAX_FILE_MB}MB.`);
      return;
    }

    fileToBase64(file)
      .then((dataBase64) => {
        setAttachedFile({
          name: file.name,
          mimeType: file.type,
          dataBase64,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        });
        if (mode !== "doubt") setMode("doubt"); // attaching a file implies a doubt
      })
      .catch(() => setAttachError("Couldn't read that file, please try again."));
  }

  function removeAttachedFile() {
    if (attachedFile?.previewUrl) URL.revokeObjectURL(attachedFile.previewUrl);
    setAttachedFile(null);
    setAttachError("");
  }

  async function sendMessage(text) {
    const trimmed = (text ?? input).trim();
    if ((!trimmed && !attachedFile) || isTyping) return;

    const fileForRequest = attachedFile;

    const userMsg = {
      id: `local-${Date.now()}`,
      role: "user",
      text: trimmed || (fileForRequest ? "(Sent a photo/PDF)" : ""),
      time: formatTime(),
      attachmentPreview: fileForRequest?.previewUrl || null,
      attachmentName: fileForRequest?.name || null,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedFile(null);
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/mentor/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: trimmed,
          mode,
          file: fileForRequest
            ? { mimeType: fileForRequest.mimeType, dataBase64: fileForRequest.dataBase64 }
            : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Mentor request failed (${res.status})`);
      }

      const reply = await res.json();

      setMessages((prev) => [
        ...prev,
        { id: reply.id, role: "mentor", text: reply.text, time: formatTime(reply.time) },
      ]);

      if (voiceReplyOn) speak(reply.text);
    } catch (err) {
      console.error("AI Mentor sendMessage error:", err);
      const failText = err.message?.includes("too large") || err.message?.includes("supported")
        ? err.message
        : "Sorry, I couldn't respond right now. Please try again in a moment.";
      setMessages((prev) => [
        ...prev,
        { id: `error-${Date.now()}`, role: "mentor", text: failText, time: formatTime() },
      ]);
      if (voiceReplyOn) speak(failText);
    } finally {
      setIsTyping(false);
    }
  }

  function handleMicClick() {
    if (isListening) return;
    if (!voiceSupported) {
      alert("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    setIsListening(true);
    listenOnce({
      onResult: (transcript) => sendMessage(transcript),
      onError: (err) => console.error("Voice input error:", err.message),
      onEnd: () => setIsListening(false),
    });
  }

  function toggleVoiceReply() {
    setVoiceReplyOn((prev) => {
      if (prev) stopSpeaking();
      return !prev;
    });
  }

  // Jumps into Doubt mode and asks Forge to re-explain a real weak topic
  function askForgeAboutWeakTopic(topic) {
    setMode("doubt");
    sendMessage(`I'm weak in "${topic}" — can you explain it from the basics with a simple example?`);
  }

  const quickPrompts = quickPromptsByMode[mode] || quickPromptsByMode.chat;

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <TopBar userName={userName} streak={user?.currentStreak ?? 0} level={user?.level ?? 1} />

        <div className="px-6 mt-4 mb-6 flex-1 flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Bot className="text-purple-400" size={20} />
                Forge AI Assistant
              </h1>
              <p className="text-sm text-gray-400">
                Personalized guidance based on your study patterns and roadmap.
              </p>
            </div>

            <button
              onClick={toggleVoiceReply}
              title={voiceReplyOn ? "Voice replies on — click to mute" : "Voice replies off — click to unmute"}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 border border-white/10 hover:bg-white/5 px-3 py-1.5 rounded-lg transition"
            >
              {voiceReplyOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {voiceReplyOn ? "Voice On" : "Voice Off"}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
            <section className="lg:col-span-2 bg-[#13131f] rounded-2xl border border-white/5 flex flex-col min-h-[560px]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center">
                    <Sparkles size={15} className="text-purple-200" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Forge AI</p>
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      Online
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {viewMode === "history" ? (
                    <button
                      onClick={startNewChat}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 border border-white/10 hover:bg-white/5 px-3 py-1.5 rounded-lg transition"
                    >
                      <Plus size={13} /> New Chat
                    </button>
                  ) : (
                    <button
                      onClick={loadHistory}
                      disabled={historyLoading}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 border border-white/10 hover:bg-white/5 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                    >
                      <History size={13} />
                      {historyLoading ? "Loading..." : "History"}
                    </button>
                  )}
                  <button
                    onClick={startNewChat}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 border border-white/10 hover:bg-white/5 px-3 py-1.5 rounded-lg transition"
                    title="Reset current view"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 pt-3">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      mode === m.id
                        ? "bg-purple-600 border-purple-600 text-white"
                        : "border-white/10 text-gray-400 hover:bg-white/5"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
                {mode === "doubt" && (
                  <span className="text-[11px] text-gray-500 ml-1">📎 Attach a photo/PDF of your doubt below</span>
                )}
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        msg.role === "user" ? "bg-purple-600 text-white" : "bg-white/10 text-purple-300"
                      }`}
                    >
                      {msg.role === "user" ? userName.charAt(0).toUpperCase() : <Bot size={15} />}
                    </div>
                    <div className={`max-w-md flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      {msg.attachmentPreview && (
                        <img
                          src={msg.attachmentPreview}
                          alt="attachment"
                          className="max-w-[180px] rounded-xl mb-1.5 border border-white/10"
                        />
                      )}
                      {!msg.attachmentPreview && msg.attachmentName && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white/5 px-2.5 py-1.5 rounded-lg mb-1.5">
                          <FileText size={12} /> {msg.attachmentName}
                        </div>
                      )}
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-purple-600 text-white rounded-tr-sm"
                            : "bg-white/5 text-gray-200 rounded-tl-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-xs text-gray-600 mt-1">{msg.time}</span>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 text-purple-300 flex items-center justify-center flex-shrink-0">
                      <Bot size={15} />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="text-xs px-3 py-1.5 rounded-full border border-purple-500/30 text-purple-300 hover:bg-purple-700/20 transition"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Attached file preview strip */}
              {attachedFile && (
                <div className="mx-4 mb-2 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  {attachedFile.previewUrl ? (
                    <img src={attachedFile.previewUrl} alt="preview" className="w-9 h-9 rounded-lg object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-purple-700/30 flex items-center justify-center">
                      <FileText size={16} className="text-purple-300" />
                    </div>
                  )}
                  <span className="text-xs text-gray-300 flex-1 truncate">{attachedFile.name}</span>
                  <button onClick={removeAttachedFile} className="text-gray-500 hover:text-gray-200">
                    <X size={15} />
                  </button>
                </div>
              )}
              {attachError && <p className="mx-4 mb-2 text-xs text-red-400">{attachError}</p>}

              <div className="p-4 border-t border-white/5 flex gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach a photo or PDF of your doubt"
                  className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition"
                >
                  <Paperclip size={16} />
                </button>
                <input
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 placeholder-gray-500"
                  placeholder={isListening ? "Listening..." : "Ask your mentor anything..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={isListening}
                />
                <button
                  onClick={handleMicClick}
                  disabled={isListening}
                  title={voiceSupported ? "Speak to Forge AI" : "Voice input not supported in this browser"}
                  className={`px-3.5 py-2.5 rounded-xl transition ${
                    isListening ? "bg-red-600 text-white animate-pulse" : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button
                  onClick={() => sendMessage()}
                  className="bg-purple-600 hover:bg-purple-700 transition text-white px-4 py-2.5 rounded-xl"
                >
                  <Send size={16} />
                </button>
              </div>
            </section>

            <section className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Lightbulb size={16} className="text-yellow-400" />
                  Smart Insights
                </h2>

                {insightsLoading ? (
                  <p className="text-xs text-gray-500">Loading real insights...</p>
                ) : (
                  <div className="space-y-3">
                    {insights.map((item, i) => {
                      const cfg = insightIconMap[item.type] || insightIconMap.milestone;
                      const Icon = cfg.icon;
                      return (
                        <div key={i} className={`rounded-xl p-3 border border-white/5 ${cfg.bg}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Icon size={14} className={cfg.color} />
                            <p className={`text-sm font-medium ${cfg.color}`}>{item.title}</p>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed">{item.text}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Weakness Detector — real ExamAttempt + FocusSession data */}
              <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Brain size={16} className="text-red-400" />
                  Weakness Detector
                </h2>

                {weaknessLoading ? (
                  <p className="text-xs text-gray-500">Analyzing your real performance...</p>
                ) : !weaknessReport?.hasData ? (
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {weaknessReport?.message ||
                      "Not enough data yet — complete a certificate exam or a few Focus Sessions to unlock this."}
                  </p>
                ) : weaknessReport.weakTopics.length === 0 ? (
                  <p className="text-xs text-green-400 leading-relaxed">
                    No weak topics detected right now — solid work across the board! 🎉
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {weaknessReport.weakTopics.map((t, i) => (
                      <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-red-300">{t.topic}</p>
                          <span className="text-xs font-semibold text-red-400">{t.avgScore}%</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-2">Based on {t.basedOn}</p>
                        <button
                          onClick={() => askForgeAboutWeakTopic(t.topic)}
                          className="flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200 transition"
                        >
                          Ask Forge to explain this <ArrowUpRight size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <h2 className="font-semibold text-sm mb-2">Today's Recommendation</h2>
                <p className="text-xs text-gray-400 leading-relaxed mb-3">
                  Switch to <span className="text-purple-300">Plan</span> mode above and
                  ask "What should I study today?" — Forge AI will build it from your
                  real pending tasks.
                </p>
                <button
                  onClick={() => {
                    setMode("planner");
                    sendMessage("What should I study today?");
                  }}
                  className="w-full text-sm bg-purple-600 hover:bg-purple-700 transition text-white py-2 rounded-xl"
                >
                  Ask mentor for a plan
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}