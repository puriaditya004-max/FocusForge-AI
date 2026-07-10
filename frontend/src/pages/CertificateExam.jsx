import React, { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import {
  Award,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  Download,
  Share2,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Shield,
} from "lucide-react";

// ---------------------------------------------------------
// CertificateExam Page
// Full exam flow: Intro → Exam (60 min timer) → Result → Certificate
// Rules:
//   - 97%+ score required (49/50 or 50/50)
//   - Max 2 attempts per certificate
//   - 4-day cooldown after a failed attempt
//   - 50 questions: 40 theory MCQ + 10 project-based
//
// Question content and answer-checking stay client-side.
// Attempt/result state now comes from the backend
// (GET/POST /api/certificate-exam) instead of localStorage.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const TOTAL_QUESTIONS = 50;
const PASS_SCORE = 97; // percent
const EXAM_MINUTES = 60;
const MAX_ATTEMPTS = 2;
const CERT_TOPIC = "Python – Month 1 Foundations";
const CERT_PROJECTS = ["Simple Calculator", "To-Do List App"];

// ── Questions ────────────────────────────────────────────
// Question content + correct answers now live server-side only
// (backend/src/data/certificateQuestions.js). We fetch the
// answer-stripped list from GET /certificate-exam/questions —
// this is what stops the exam from being spoofed via devtools.

function formatTime(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ── Screens ──────────────────────────────────────────────
const SCREEN = { LOADING: "loading", INTRO: "intro", EXAM: "exam", RESULT: "result", CERT: "cert", LOCKED: "locked" };

export default function CertificateExam() {
  const [screen, setScreen] = useState(SCREEN.LOADING);
  const [status, setStatus] = useState(null); // { attemptsUsed, maxAttempts, certEarned, certificate, cooldownDaysLeft, isLocked }
  const [loadError, setLoadError] = useState("");
  const [questions, setQuestions] = useState([]); // fetched from backend, no `answer` field included

  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_MINUTES * 60);
  const [examStarted, setExamStarted] = useState(false);
  const [examStartedAt, setExamStartedAt] = useState(null);
  const [score, setScore] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef(null);
  const certRef = useRef(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch(
        `${API_BASE}/certificate-exam/status?topic=${encodeURIComponent(CERT_TOPIC)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load exam status");
      }
      setStatus(data);
      setLoadError("");

      // Only fetch questions if the student can actually take the exam —
      // no point loading the bank for a locked/cooldown/already-certified state.
      if (!data.certEarned && !data.isLocked && data.cooldownDaysLeft <= 0) {
        await fetchQuestions();
      }
      setScreen(data.certEarned ? SCREEN.CERT : data.isLocked ? SCREEN.LOCKED : SCREEN.INTRO);
    } catch (err) {
      setLoadError(err.message || "Failed to load exam status");
    }
  }

  async function fetchQuestions() {
    const res = await fetch(
      `${API_BASE}/certificate-exam/questions?topic=${encodeURIComponent(CERT_TOPIC)}`,
      { credentials: "include" }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to load exam questions");
    }
    setQuestions(data.questions);
  }

  const submitExam = useCallback(
    async (currentAnswers) => {
      clearInterval(timerRef.current);
      setSubmitting(true);

      try {
        // We only send the student's selected option indices — never a
        // score. The server grades against the real question bank, so
        // the result can't be spoofed by editing the request body.
        const res = await fetch(`${API_BASE}/certificate-exam/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            topic: CERT_TOPIC,
            answers: currentAnswers,
            projectsCompleted: CERT_PROJECTS,
            startedAt: examStartedAt,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to submit exam");
        }
        setScore({ correct: data.correct, pct: data.score });
        setStatus(data);
        setScreen(data.passed ? SCREEN.CERT : SCREEN.RESULT);
      } catch (err) {
        setLoadError(err.message || "Failed to submit exam");
        setScreen(SCREEN.RESULT);
      } finally {
        setSubmitting(false);
      }
    },
    [examStartedAt]
  );

  // Timer
  useEffect(() => {
    if (!examStarted) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitExam(answers);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [examStarted, submitExam, answers]);

  function startExam() {
    setAnswers({});
    setCurrent(0);
    setSecondsLeft(EXAM_MINUTES * 60);
    setExamStarted(true);
    setExamStartedAt(new Date().toISOString());
    setScreen(SCREEN.EXAM);
  }

  function selectAnswer(qId, idx) {
    setAnswers((prev) => ({ ...prev, [qId]: idx }));
  }

  function handleSubmit() {
    submitExam(answers);
  }

  // ── Certificate download ──────────────────────────────
  function downloadCert() {
    if (!certRef.current) return;
    import("html2canvas")
      .then(({ default: html2canvas }) => {
        html2canvas(certRef.current, { scale: 2, backgroundColor: null }).then((canvas) => {
          const link = document.createElement("a");
          link.download = `FocusForge_Certificate.png`;
          link.href = canvas.toDataURL();
          link.click();
        });
      })
      .catch(() => {
        alert("html2canvas not installed. Run: npm install html2canvas");
      });
  }

  // ────────────────────────────────────────────────────────
  // SCREEN: LOADING
  // ────────────────────────────────────────────────────────
  if (screen === SCREEN.LOADING) {
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <TopBar userName="Student" streak={0} level={1} />
          <div className="flex-1 flex items-center justify-center p-8">
            {loadError ? (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 max-w-md text-center">
                {loadError}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Loading exam status...</p>
            )}
          </div>
        </main>
      </div>
    );
  }

  const answered = Object.keys(answers).length;
  const q = questions[current];
  const timerWarning = secondsLeft < 300;

  // ────────────────────────────────────────────────────────
  // SCREEN: LOCKED
  // ────────────────────────────────────────────────────────
  if (screen === SCREEN.LOCKED) {
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <TopBar userName="Student" streak={0} level={1} />
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="bg-[#13131f] border border-red-500/20 rounded-2xl p-10 max-w-md text-center">
              <Lock size={48} className="text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-red-400 mb-2">Certificate Locked</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                You have used both attempts and did not achieve the required 97% score.
                Unfortunately, the certificate for this module cannot be issued.
              </p>
              <p className="text-gray-500 text-xs mt-4">
                Complete Month 2 of the roadmap and you'll get a fresh chance for the next certificate.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────
  // SCREEN: INTRO
  // ────────────────────────────────────────────────────────
  if (screen === SCREEN.INTRO) {
    const canStart = status.cooldownDaysLeft === 0;
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <TopBar userName="Student" streak={0} level={1} />
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-[#13131f] border border-white/5 rounded-2xl p-8 max-w-2xl w-full">
              <div className="flex items-center gap-3 mb-6">
                <Award size={36} className="text-yellow-400" />
                <div>
                  <h1 className="text-xl font-bold">Certificate Exam</h1>
                  <p className="text-sm text-gray-400">{CERT_TOPIC}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Questions", value: `${TOTAL_QUESTIONS}` },
                  { label: "Time Limit", value: `${EXAM_MINUTES} min` },
                  { label: "Pass Score", value: `${PASS_SCORE}%` },
                  { label: "Attempts Left", value: `${MAX_ATTEMPTS - status.attemptsUsed} / ${MAX_ATTEMPTS}` },
                ].map((s) => (
                  <div key={s.label} className="bg-[#0e0e18] rounded-xl p-3 text-center border border-white/5">
                    <p className="text-lg font-bold text-purple-300">{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 mb-6 space-y-2">
                <p className="text-sm font-medium text-yellow-400 flex items-center gap-2">
                  <AlertTriangle size={16} /> Rules — Read carefully
                </p>
                <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                  <li>50 questions: 40 theory MCQ + 10 project-based</li>
                  <li>You need <span className="text-yellow-400 font-semibold">97% or above</span> (49 or 50 correct) to earn the certificate</li>
                  <li>Maximum <span className="text-yellow-400 font-semibold">2 attempts</span> only — use them wisely</li>
                  <li>If you fail, next attempt unlocks after <span className="text-yellow-400 font-semibold">4 days</span></li>
                  <li>Timer is 60 minutes — exam auto-submits when time runs out</li>
                  <li>Do not refresh the page during the exam</li>
                </ul>
              </div>

              <div className="mb-4 text-sm text-gray-400 space-y-1">
                <p>📌 Projects completed: {CERT_PROJECTS.join(", ")}</p>
                <p>📌 Attempt {status.attemptsUsed + 1} of {MAX_ATTEMPTS}</p>
              </div>

              {!canStart ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300">
                  <Clock size={16} className="inline mr-2" />
                  Next attempt available in <strong>{Math.ceil(status.cooldownDaysLeft)} day(s)</strong>
                </div>
              ) : (
                <button
                  onClick={startExam}
                  disabled={questions.length === 0}
                  className="w-full bg-purple-600 hover:bg-purple-500 transition text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Shield size={18} />
                  {questions.length === 0 ? "Loading questions..." : `Start Exam — Attempt ${status.attemptsUsed + 1}`}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────
  // SCREEN: EXAM
  // ────────────────────────────────────────────────────────
  if (screen === SCREEN.EXAM) {
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <TopBar userName="Student" streak={0} level={1} />
          <div className="px-6 mt-4 mb-8 flex flex-col gap-4 max-w-3xl w-full mx-auto">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs text-gray-500">Question {current + 1} of {TOTAL_QUESTIONS}</p>
                <p className="text-xs text-gray-500">{answered} answered</p>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-lg border ${timerWarning ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-white/10 bg-[#13131f] text-purple-300"}`}>
                <Clock size={16} /> {formatTime(secondsLeft)}
              </div>
            </div>

            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-purple-500 transition-all" style={{ width: `${((current + 1) / TOTAL_QUESTIONS) * 100}%` }} />
            </div>

            <div className="bg-[#13131f] rounded-2xl border border-white/5 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs px-2 py-0.5 rounded-full ${q.type === "project" ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "bg-blue-500/20 text-blue-300 border border-blue-500/30"}`}>
                  {q.type === "project" ? "🏗️ Project" : "📚 Theory"}
                </span>
              </div>
              <p className="text-base font-medium text-gray-100 mb-6 leading-relaxed whitespace-pre-wrap">
                {q.q}
              </p>
              <div className="space-y-3">
                {q.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectAnswer(q.id, idx)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                      answers[q.id] === idx
                        ? "bg-purple-600/30 border-purple-500 text-white"
                        : "bg-white/3 border-white/10 text-gray-300 hover:bg-white/5 hover:border-purple-500/30"
                    }`}
                  >
                    <span className="font-semibold text-gray-500 mr-2">{String.fromCharCode(65 + idx)}.</span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setCurrent((p) => Math.max(0, p - 1))}
                disabled={current === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-30 transition"
              >
                <ChevronLeft size={16} /> Previous
              </button>

              <div className="flex gap-1 flex-wrap justify-center">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`w-6 h-6 rounded text-[10px] font-medium transition ${
                      i === current
                        ? "bg-purple-600 text-white"
                        : answers[questions[i].id] !== undefined
                        ? "bg-green-600/40 text-green-300"
                        : "bg-white/5 text-gray-500"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              {current < TOTAL_QUESTIONS - 1 ? (
                <button
                  onClick={() => setCurrent((p) => Math.min(TOTAL_QUESTIONS - 1, p + 1))}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-gray-300 hover:bg-white/5 transition"
                >
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Exam"}
                </button>
              )}
            </div>

            {answered === TOTAL_QUESTIONS && current !== TOTAL_QUESTIONS - 1 && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "✅ All answered — Submit Exam"}
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────
  // SCREEN: RESULT (fail)
  // ────────────────────────────────────────────────────────
  if (screen === SCREEN.RESULT && score) {
    const noMoreAttempts = status.isLocked;
    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <TopBar userName="Student" streak={0} level={1} />
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-[#13131f] border border-white/5 rounded-2xl p-8 max-w-md w-full text-center">
              <XCircle size={52} className="text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-red-400 mb-1">Not Passed</h2>
              <p className="text-gray-400 text-sm mb-6">You need 97% to earn the certificate</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-[#0e0e18] rounded-xl p-4 border border-white/5">
                  <p className="text-3xl font-bold text-red-400">{score.pct}%</p>
                  <p className="text-xs text-gray-500">Your score</p>
                </div>
                <div className="bg-[#0e0e18] rounded-xl p-4 border border-white/5">
                  <p className="text-3xl font-bold text-purple-300">{score.correct}/{TOTAL_QUESTIONS}</p>
                  <p className="text-xs text-gray-500">Correct answers</p>
                </div>
              </div>

              <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden mb-2">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${score.pct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-600 mb-6">
                <span>0%</span>
                <span className="text-yellow-500">97% needed</span>
                <span>100%</span>
              </div>

              {noMoreAttempts ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300">
                  <Lock size={16} className="inline mr-2" />
                  Both attempts used. Certificate cannot be issued for this module.
                </div>
              ) : (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-sm text-orange-300">
                  <Clock size={16} className="inline mr-2" />
                  You have <strong>{MAX_ATTEMPTS - status.attemptsUsed} attempt(s) remaining</strong>. Next attempt unlocks in{" "}
                  <strong>{Math.ceil(status.cooldownDaysLeft)} days</strong>. Study harder and come back!
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────
  // SCREEN: CERTIFICATE
  // ────────────────────────────────────────────────────────
  if (screen === SCREEN.CERT) {
    const cert = status.certificate;
    const displayScore = score?.pct ?? cert?.score ?? 100;
    const issueDate = cert
      ? new Date(cert.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

    return (
      <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col">
          <TopBar userName="Student" streak={0} level={1} />
          <div className="px-6 mt-4 mb-8 flex flex-col items-center gap-5">
            <div className="text-center">
              <h1 className="text-lg font-semibold flex items-center justify-center gap-2">
                <Award className="text-yellow-400" size={20} />
                Certificate of Completion
              </h1>
              <p className="text-sm text-gray-400">You passed with {displayScore}% — Congratulations! 🎉</p>
            </div>

            <div
              ref={certRef}
              className="w-full max-w-2xl bg-white text-gray-900 rounded-2xl shadow-2xl overflow-hidden"
              style={{ fontFamily: "Georgia, serif" }}
            >
              <div className="h-3 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />

              <div className="px-10 py-8">
                <div className="text-center mb-6">
                  <p className="text-xs tracking-[0.3em] text-yellow-700 uppercase font-sans font-semibold mb-1">
                    FocusForge AI
                  </p>
                  <h2 className="text-3xl font-bold text-gray-800 mb-1" style={{ letterSpacing: "0.05em" }}>
                    Certificate of Completion
                  </h2>
                  <div className="w-24 h-0.5 bg-yellow-500 mx-auto" />
                </div>

                <div className="text-center mb-6">
                  <p className="text-sm text-gray-500 font-sans mb-2">This certifies that</p>
                  <p className="text-sm text-gray-500 font-sans mb-1">has successfully completed</p>
                  <p className="text-xl font-bold text-yellow-700">{CERT_TOPIC}</p>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6 border-t border-b border-gray-200 py-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-sans uppercase tracking-wider mb-1">Score Achieved</p>
                    <p className="text-xl font-bold text-green-600">{displayScore}%</p>
                  </div>
                  <div className="text-center border-x border-gray-200">
                    <p className="text-xs text-gray-400 font-sans uppercase tracking-wider mb-1">Projects Done</p>
                    <p className="text-sm font-semibold text-gray-700">{CERT_PROJECTS.length}</p>
                    <p className="text-xs text-gray-500">{CERT_PROJECTS.join(", ")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-sans uppercase tracking-wider mb-1">Issue Date</p>
                    <p className="text-sm font-semibold text-gray-700">{issueDate}</p>
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-sans mb-1">Certificate ID</p>
                    <p className="text-xs font-mono text-gray-600">{cert?.certificateCode ?? "—"}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-20 border-t border-gray-400 mb-1" />
                    <p className="text-xs text-gray-500 font-sans">FocusForge AI</p>
                  </div>
                </div>
              </div>

              <div className="h-3 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600" />
            </div>

            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={downloadCert}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold px-5 py-2.5 rounded-xl transition text-sm"
              >
                <Download size={16} /> Download Certificate
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: "FocusForge Certificate", text: `I completed ${CERT_TOPIC} on FocusForge AI!` });
                  }
                }}
                className="flex items-center gap-2 border border-white/10 hover:bg-white/5 px-5 py-2.5 rounded-xl transition text-sm text-gray-300"
              >
                <Share2 size={16} /> Share
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}
