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
} from "lucide-react";

// ---------------------------------------------------------
// AI Mentor Page
// Chat-style interface + a side panel of insights/suggestions
// derived from the user's study data (insights are still
// dummy for now, same shape as Progress.jsx — wire to real
// aggregated data later, same pattern as Dashboard.jsx).
//
// Chat itself is now REAL:
// - POST /api/mentor/message  -> sends message, gets AI reply
//   (backend decides Gemini free tier vs student's own Claude
//   key automatically — see mentor.controller.js)
// - GET  /api/mentor/history  -> loads all past saved messages
//
// UX pattern: opening the page always starts a fresh greeting
// (Good Morning/Afternoon/Evening) so it doesn't feel like a
// wall of old text. If the student wants to see/continue an
// older conversation, they tap "History" — that loads what's
// actually saved in the DB. Since there's only one continuous
// thread per student in the schema, sending a message from
// either view saves to the same place.
// ---------------------------------------------------------

const API_BASE = "http://localhost:5000/api";

const quickPrompts = [
  "What should I study today?",
  "I'm losing motivation",
  "Explain OOP in simple terms",
  "Review my this week's progress",
];

const insights = [
  {
    icon: TrendingUp,
    color: "text-green-400",
    bg: "bg-green-400/10",
    title: "You're improving",
    text: "Focus score is up 8% compared to last week. Keep this routine going.",
  },
  {
    icon: AlertCircle,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    title: "Saturday dip detected",
    text: "Study hours drop noticeably every Saturday. Try a lighter, shorter session instead of skipping.",
  },
  {
    icon: Target,
    color: "text-purple-300",
    bg: "bg-purple-400/10",
    title: "Next milestone",
    text: "Finish Week 1's Simple Calculator project to unlock Week 2: Lists, Tuples & Dictionaries.",
  },
];

function getTimeBasedGreeting(name) {
  const hour = new Date().getHours();
  let greetingWord = "Hello";
  if (hour < 12) greetingWord = "Good morning";
  else if (hour < 17) greetingWord = "Good afternoon";
  else greetingWord = "Good evening";

  return `${greetingWord}, ${name} 👋 I'm your AI Mentor. I can help you plan your day, explain tricky topics, or just keep you motivated. What's on your mind?`;
}

function formatTime(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// Builds a fresh, client-only greeting bubble (NOT saved to DB —
// only real user/mentor messages get saved, via the backend).
function buildFreshGreeting(name) {
  return [
    {
      id: "greeting",
      role: "mentor",
      text: getTimeBasedGreeting(name),
      time: formatTime(),
    },
  ];
}

export default function AiMentor() {
  const { user } = useAuth();
  const userName = user?.name || "Student"; // wired from AuthContext, same as TopBar prop below

  const [messages, setMessages] = useState(() => buildFreshGreeting(userName));
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [viewMode, setViewMode] = useState("new"); // "new" | "history"
  const [historyLoading, setHistoryLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mentor/history`, {
        method: "GET",
        credentials: "include", // sends httpOnly JWT cookie
      });
      const data = await res.json();
      const results = data.results || []; // API responses are wrapped — known gotcha

      if (results.length === 0) {
        // No saved history yet — just show the greeting instead of an empty screen
        setMessages(buildFreshGreeting(userName));
      } else {
        setMessages(results);
      }
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

  async function sendMessage(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || isTyping) return;

    const userMsg = {
      id: `local-${Date.now()}`,
      role: "user",
      text: trimmed,
      time: formatTime(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/mentor/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        throw new Error(`Mentor request failed (${res.status})`);
      }

      const reply = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: reply.id,
          role: "mentor",
          text: reply.text,
          time: formatTime(reply.time),
        },
      ]);
    } catch (err) {
      console.error("AI Mentor sendMessage error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "mentor",
          text: "Sorry, I couldn't respond right now. Please try again in a moment.",
          time: formatTime(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <TopBar userName={userName} streak={12} level={8} />

        <div className="px-6 mt-4 mb-6 flex-1 flex flex-col">
          <div className="mb-4">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Bot className="text-purple-400" size={20} />
              AI Mentor
            </h1>
            <p className="text-sm text-gray-400">
              Personalized guidance based on your study patterns and roadmap.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
            {/* Chat panel */}
            <section className="lg:col-span-2 bg-[#13131f] rounded-2xl border border-white/5 flex flex-col min-h-[560px]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center">
                    <Sparkles size={15} className="text-purple-200" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">FocusForge Mentor</p>
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

              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        msg.role === "user"
                          ? "bg-purple-600 text-white"
                          : "bg-white/10 text-purple-300"
                      }`}
                    >
                      {msg.role === "user" ? userName.charAt(0).toUpperCase() : <Bot size={15} />}
                    </div>
                    <div
                      className={`max-w-md flex flex-col ${
                        msg.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-purple-600 text-white rounded-tr-sm"
                            : "bg-white/5 text-gray-200 rounded-tl-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-xs text-gray-600 mt-1">
                        {msg.time}
                      </span>
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

              {/* Quick prompts */}
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

              {/* Input */}
              <div className="p-4 border-t border-white/5 flex gap-3">
                <input
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 placeholder-gray-500"
                  placeholder="Ask your mentor anything..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button
                  onClick={() => sendMessage()}
                  className="bg-purple-600 hover:bg-purple-700 transition text-white px-4 py-2.5 rounded-xl"
                >
                  <Send size={16} />
                </button>
              </div>
            </section>

            {/* Insights panel */}
            <section className="lg:col-span-1 flex flex-col gap-4">
              <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Lightbulb size={16} className="text-yellow-400" />
                  Smart Insights
                </h2>
                <div className="space-y-3">
                  {insights.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={i}
                        className={`rounded-xl p-3 border border-white/5 ${item.bg}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={14} className={item.color} />
                          <p className={`text-sm font-medium ${item.color}`}>
                            {item.title}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#13131f] rounded-2xl p-4 border border-white/5">
                <h2 className="font-semibold text-sm mb-2">
                  Today's Recommendation
                </h2>
                <p className="text-xs text-gray-400 leading-relaxed mb-3">
                  Continue Week 1: Python Setup, Syntax & Variables. You're
                  60% through — finishing today keeps your roadmap on
                  schedule.
                </p>
                <button
                  onClick={() => sendMessage("What should I study today?")}
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