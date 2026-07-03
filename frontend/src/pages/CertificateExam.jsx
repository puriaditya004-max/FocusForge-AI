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
const questions = [
  { id: 1, type: "theory", q: "Which of the following is NOT a valid Python data type?", options: ["int", "float", "char", "bool"], answer: 2 },
  { id: 2, type: "theory", q: "What will `type(3.0)` return?", options: ["<class 'int'>", "<class 'float'>", "<class 'double'>", "<class 'number'>"], answer: 1 },
  { id: 3, type: "theory", q: "Which keyword is used to define a function in Python?", options: ["function", "define", "def", "fun"], answer: 2 },
  { id: 4, type: "theory", q: "What is the output of `print(10 // 3)`?", options: ["3.33", "3", "4", "1"], answer: 1 },
  { id: 5, type: "theory", q: "Which operator is used for exponentiation in Python?", options: ["^", "**", "^^", "exp()"], answer: 1 },
  { id: 6, type: "theory", q: "What does `len('hello')` return?", options: ["4", "5", "6", "Error"], answer: 1 },
  { id: 7, type: "theory", q: "Which of these is a mutable data type?", options: ["tuple", "string", "list", "int"], answer: 2 },
  { id: 8, type: "theory", q: "What will `bool(0)` return?", options: ["True", "False", "0", "None"], answer: 1 },
  { id: 9, type: "theory", q: "Which function is used to take input from the user?", options: ["get()", "input()", "read()", "scan()"], answer: 1 },
  { id: 10, type: "theory", q: "What is the correct way to comment a single line in Python?", options: ["// comment", "/* comment */", "# comment", "<!-- comment -->"], answer: 2 },
  { id: 11, type: "theory", q: "What will `print(type('5'))` output?", options: ["<class 'int'>", "<class 'str'>", "<class 'char'>", "<class 'float'>"], answer: 1 },
  { id: 12, type: "theory", q: "What does `int('42')` do?", options: ["Raises TypeError", "Returns 42 as integer", "Returns '42' as string", "Returns 42.0"], answer: 1 },
  { id: 13, type: "theory", q: "Which of the following will cause a ZeroDivisionError?", options: ["10 / 2", "10 % 3", "10 // 0", "10 ** 0"], answer: 2 },
  { id: 14, type: "theory", q: "What is the output of `print(2 ** 3 ** 2)`?", options: ["64", "512", "72", "8"], answer: 1 },
  { id: 15, type: "theory", q: "Which of these is a valid variable name in Python?", options: ["2name", "my-var", "_myVar", "class"], answer: 2 },
  { id: 16, type: "theory", q: "What will `print('5' + '3')` output?", options: ["8", "53", "Error", "'5'+'3'"], answer: 1 },
  { id: 17, type: "theory", q: "What does the `%` operator do in Python?", options: ["Division", "Percentage", "Modulus (remainder)", "Power"], answer: 2 },
  { id: 18, type: "theory", q: "Which loop is best when you don't know how many times to iterate?", options: ["for loop", "while loop", "do-while loop", "foreach loop"], answer: 1 },
  { id: 19, type: "theory", q: "What will `range(1, 5)` generate?", options: ["1,2,3,4,5", "1,2,3,4", "0,1,2,3,4", "1,2,3"], answer: 1 },
  { id: 20, type: "theory", q: "What is the output of this code?\n```\nx = 10\nif x > 5:\n  print('A')\nelse:\n  print('B')\n```", options: ["B", "A", "AB", "Error"], answer: 1 },
  { id: 21, type: "theory", q: "What is the purpose of `__init__` in a Python class?", options: ["To destroy an object", "To initialize object attributes", "To define class methods", "To inherit from parent"], answer: 1 },
  { id: 22, type: "theory", q: "What is `self` in a Python class method?", options: ["A global variable", "Reference to the current object instance", "A reserved keyword for strings", "Name of the class"], answer: 1 },
  { id: 23, type: "theory", q: "Which OOP concept allows a class to inherit from multiple parent classes?", options: ["Polymorphism", "Encapsulation", "Multiple Inheritance", "Abstraction"], answer: 2 },
  { id: 24, type: "theory", q: "What does `super()` do in Python?", options: ["Deletes the parent class", "Calls a method from the parent class", "Creates a new subclass", "Overrides all parent methods"], answer: 1 },
  { id: 25, type: "theory", q: "What is encapsulation in OOP?", options: ["Inheriting parent methods", "Hiding internal details and exposing only necessary parts", "Running multiple methods simultaneously", "Creating multiple objects from one class"], answer: 1 },
  { id: 26, type: "theory", q: "What will `print(10 != 10)` output?", options: ["True", "False", "0", "Error"], answer: 1 },
  { id: 27, type: "theory", q: "What is the output of `print(not True and False)`?", options: ["True", "False", "None", "Error"], answer: 1 },
  { id: 28, type: "theory", q: "Which format method correctly displays: `Hello Aryan`?\n```\nname = 'Aryan'\n```", options: ["print('Hello' + name)", "print(f'Hello {name}')", "print('Hello', {name})", "Both A and B"], answer: 3 },
  { id: 29, type: "theory", q: "What does `input()` always return?", options: ["int", "float", "str", "depends on what user types"], answer: 2 },
  { id: 30, type: "theory", q: "What is the output of:\n```\nx = 5\nx += 3\nprint(x)\n```", options: ["5", "3", "8", "53"], answer: 2 },
  { id: 31, type: "theory", q: "What is the output of `print(0.1 + 0.2 == 0.3)` in Python?", options: ["True", "False", "Error", "0.3"], answer: 1 },
  { id: 32, type: "theory", q: "What will `print(bool(''))` output?", options: ["True", "False", "None", "Error"], answer: 1 },
  { id: 33, type: "theory", q: "What is the output of `print(1_000_000)`?", options: ["Error", "1_000_000", "1000000", "1,000,000"], answer: 2 },
  { id: 34, type: "theory", q: "What does `pass` do in Python?", options: ["Stops execution", "Does nothing — placeholder", "Skips to next iteration", "Raises an exception"], answer: 1 },
  { id: 35, type: "theory", q: "What will this print?\n```\nfor i in range(3):\n  if i == 1:\n    continue\n  print(i)\n```", options: ["0 1 2", "0 2", "1 2", "0 1"], answer: 1 },
  { id: 36, type: "theory", q: "What is the output of `print(list(range(0, 10, 3)))`?", options: ["[0,3,6,9]", "[0,3,6]", "[3,6,9]", "[0,3,6,9,12]"], answer: 0 },
  { id: 37, type: "theory", q: "Which of these will NOT cause an error?\n```\nx = None\n```\nThen `print(x + 1)`", options: ["No error — prints 1", "TypeError", "NameError", "None1"], answer: 1 },
  { id: 38, type: "theory", q: "What is the result of `'abc' * 3`?", options: ["Error", "'abc abc abc'", "'abcabcabc'", "9"], answer: 2 },
  { id: 39, type: "theory", q: "What will `int(3.9)` return?", options: ["4", "3", "3.9", "Error"], answer: 1 },
  { id: 40, type: "theory", q: "What is the output of:\n```\nx = [1,2,3]\nx.append(4)\nprint(len(x))\n```", options: ["3", "4", "5", "Error"], answer: 1 },
  { id: 41, type: "project", q: "In your Simple Calculator project, which Python concept did you use to repeatedly ask the user for input until they choose to quit?", options: ["for loop", "while loop with a break condition", "recursion", "do-while loop"], answer: 1 },
  { id: 42, type: "project", q: "Your calculator needs to handle division by zero. Which Python tool is best for this?", options: ["if x != 0", "try-except block", "while x > 0", "assert statement"], answer: 1 },
  { id: 43, type: "project", q: "In the calculator project, what does `float(input())` do compared to just `input()`?", options: ["Both are the same", "Converts user input from string to decimal number", "Converts user input to integer", "Raises an error"], answer: 1 },
  { id: 44, type: "project", q: "To add operations like +,-,*,/ in your calculator, which structure is most Pythonic?", options: ["Nested if-elif-else", "Dictionary mapping operators to functions", "Multiple functions with same name", "Switch statement"], answer: 1 },
  { id: 45, type: "project", q: "Your To-Do List app needs to mark a task as complete. If tasks is a list of dicts, what is the correct way?", options: ["tasks[index] = done", "tasks[index]['done'] = True", "tasks.complete(index)", "done(tasks[index])"], answer: 1 },
  { id: 46, type: "project", q: "In a To-Do app, which data structure best stores multiple tasks with properties (title, done, priority)?", options: ["List of strings", "List of dictionaries", "Single string", "Tuple of integers"], answer: 1 },
  { id: 47, type: "project", q: "To delete a task at position 2 from a list in Python:", options: ["tasks.remove(2)", "del tasks[2]", "tasks.delete(2)", "tasks.pop(index=2)"], answer: 1 },
  { id: 48, type: "project", q: "Your calculator shows wrong result: `'5' + '3' = '53'`. What is the fix?", options: ["Use `str()` on both", "Use `int()` or `float()` to convert inputs before adding", "Use `print()` differently", "This is correct behavior"], answer: 1 },
  { id: 49, type: "project", q: "In your calculator, the user enters `'abc'` instead of a number. What happens with `float('abc')`?", options: ["Returns 0.0", "Returns None", "Raises ValueError", "Returns 'abc'"], answer: 2 },
  { id: 50, type: "project", q: "What is the best way to display `Result: 8.0` when the user calculates `4 * 2`?", options: ["print('Result: ' + result)", "print(f'Result: {result}')", "print('Result:', result)", "Both B and C are correct"], answer: 3 },
];

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
      setScreen(data.certEarned ? SCREEN.CERT : data.isLocked ? SCREEN.LOCKED : SCREEN.INTRO);
      setLoadError("");
    } catch (err) {
      setLoadError(err.message || "Failed to load exam status");
    }
  }

  const submitExam = useCallback(
    async (currentAnswers) => {
      clearInterval(timerRef.current);
      setSubmitting(true);
      let correct = 0;
      questions.forEach((q) => {
        if (currentAnswers[q.id] === q.answer) correct++;
      });
      const pct = Math.round((correct / TOTAL_QUESTIONS) * 100);
      setScore({ correct, pct });

      try {
        const res = await fetch(`${API_BASE}/certificate-exam/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            topic: CERT_TOPIC,
            correct,
            totalQuestions: TOTAL_QUESTIONS,
            projectsCompleted: CERT_PROJECTS,
            startedAt: examStartedAt,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to submit exam");
        }
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
                  className="w-full bg-purple-600 hover:bg-purple-500 transition text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  <Shield size={18} /> Start Exam — Attempt {status.attemptsUsed + 1}
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
