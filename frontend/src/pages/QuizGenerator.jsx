import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import {
  Brain,
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------
// Quiz Generator — Forge AI generates a real MCQ quiz on
// whatever topic the student types. Grading happens on the
// frontend (same trust model as Certificate Exam). Once
// submitted, the REAL score is saved via POST /quiz-attempt,
// which also feeds the Weakness Detector on the AI Mentor page.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// screen: "setup" | "quiz" | "result"
export default function QuizGenerator() {
  const { user } = useAuth();

  const [screen, setScreen] = useState("setup");
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState([]); // index per question
  const [showExplanation, setShowExplanation] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { correctCount, totalQuestions, scorePercent }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!topic.trim()) return;

    setError("");
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/mentor/generate-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topic: topic.trim(), numQuestions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate quiz.");

      setQuestions(data.questions);
      setSelectedAnswers(new Array(data.questions.length).fill(null));
      setCurrentIndex(0);
      setShowExplanation(false);
      setScreen("quiz");
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function handleSelectOption(optionIndex) {
    if (showExplanation) return; // already answered this question
    const updated = [...selectedAnswers];
    updated[currentIndex] = optionIndex;
    setSelectedAnswers(updated);
    setShowExplanation(true);
  }

  function handleNextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setShowExplanation(false);
    } else {
      finishQuiz();
    }
  }

  async function finishQuiz() {
    const correctCount = questions.reduce(
      (sum, q, i) => sum + (selectedAnswers[i] === q.correctIndex ? 1 : 0),
      0
    );
    const totalQuestions = questions.length;
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);

    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/mentor/quiz-attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topic, correctCount, totalQuestions }),
      });
    } catch (err) {
      console.error("Failed to save quiz attempt:", err);
      // Don't block showing the result even if saving failed
    } finally {
      setSubmitting(false);
      setResult({ correctCount, totalQuestions, scorePercent });
      setScreen("result");
    }
  }

  function handleRetakeNewTopic() {
    setScreen("setup");
    setTopic("");
    setQuestions([]);
    setSelectedAnswers([]);
    setResult(null);
    setError("");
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="flex min-h-screen bg-[#0b0b14] text-gray-100">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <TopBar userName={user?.name || "Student"} streak={user?.currentStreak ?? 0} level={user?.level ?? 1} />

        <div className="px-6 mt-4 mb-6 flex-1 flex flex-col">
          <div className="mb-4">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="text-purple-400" size={20} />
              Quiz Generator
            </h1>
            <p className="text-sm text-gray-400">
              Forge AI builds a real quiz on any topic — your score feeds the Weakness Detector.
            </p>
          </div>

          <div className="flex-1 flex items-center justify-center">
            {/* --- SETUP SCREEN --- */}
            {screen === "setup" && (
              <div className="bg-[#13131f] rounded-2xl border border-white/5 p-6 w-full max-w-md">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-full bg-purple-700 flex items-center justify-center">
                    <Sparkles size={16} className="text-purple-200" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Generate a Quiz</p>
                    <p className="text-xs text-gray-500">Type any topic you're studying</p>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg p-2 mb-3">
                    {error}
                  </div>
                )}

                <form onSubmit={handleGenerate} className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Topic</label>
                    <input
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g. Python Loops, Newton's Laws, OOP Concepts"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Number of questions</label>
                    <div className="flex gap-2">
                      {[3, 5, 8, 10].map((n) => (
                        <button
                          type="button"
                          key={n}
                          onClick={() => setNumQuestions(n)}
                          className={`flex-1 py-2 rounded-lg text-sm transition ${
                            numQuestions === n
                              ? "bg-purple-600 text-white"
                              : "bg-white/5 text-gray-400 hover:bg-white/10"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={generating || !topic.trim()}
                    className="mt-1 bg-purple-600 hover:bg-purple-700 transition text-white py-2.5 rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Generating quiz...
                      </>
                    ) : (
                      "Generate Quiz"
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* --- QUIZ SCREEN --- */}
            {screen === "quiz" && currentQuestion && (
              <div className="bg-[#13131f] rounded-2xl border border-white/5 p-6 w-full max-w-lg">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-gray-500">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="text-xs text-purple-300">{topic}</span>
                </div>

                <div className="w-full h-1.5 bg-white/5 rounded-full mb-5 overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all"
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                  />
                </div>

                <p className="text-base font-medium mb-4">{currentQuestion.question}</p>

                <div className="flex flex-col gap-2 mb-4">
                  {currentQuestion.options.map((opt, i) => {
                    const isSelected = selectedAnswers[currentIndex] === i;
                    const isCorrect = i === currentQuestion.correctIndex;
                    let stateClass = "border-white/10 hover:bg-white/5";

                    if (showExplanation) {
                      if (isCorrect) stateClass = "border-green-500/50 bg-green-500/10";
                      else if (isSelected && !isCorrect) stateClass = "border-red-500/50 bg-red-500/10";
                    } else if (isSelected) {
                      stateClass = "border-purple-500 bg-purple-500/10";
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handleSelectOption(i)}
                        disabled={showExplanation}
                        className={`text-left px-4 py-3 rounded-xl border text-sm transition flex items-center justify-between ${stateClass}`}
                      >
                        <span>{opt}</span>
                        {showExplanation && isCorrect && <CheckCircle2 size={16} className="text-green-400" />}
                        {showExplanation && isSelected && !isCorrect && <XCircle size={16} className="text-red-400" />}
                      </button>
                    );
                  })}
                </div>

                {showExplanation && (
                  <div className="bg-white/5 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-400 leading-relaxed">{currentQuestion.explanation}</p>
                  </div>
                )}

                {showExplanation && (
                  <button
                    onClick={handleNextQuestion}
                    disabled={submitting}
                    className="w-full bg-purple-600 hover:bg-purple-700 transition text-white py-2.5 rounded-lg text-sm disabled:opacity-60"
                  >
                    {submitting
                      ? "Saving..."
                      : currentIndex < questions.length - 1
                      ? "Next Question"
                      : "Finish Quiz"}
                  </button>
                )}
              </div>
            )}

            {/* --- RESULT SCREEN --- */}
            {screen === "result" && result && (
              <div className="bg-[#13131f] rounded-2xl border border-white/5 p-6 w-full max-w-md text-center">
                <div
                  className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                    result.scorePercent >= 70 ? "bg-green-500/10" : "bg-red-500/10"
                  }`}
                >
                  <span
                    className={`text-xl font-bold ${
                      result.scorePercent >= 70 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {result.scorePercent}%
                  </span>
                </div>

                <p className="font-semibold mb-1">
                  {result.correctCount} / {result.totalQuestions} correct
                </p>
                <p className="text-sm text-gray-400 mb-5">
                  on <span className="text-purple-300">{topic}</span>
                </p>

                {result.scorePercent < 70 && (
                  <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                    This topic will now show up in your Weakness Detector on the AI Mentor page —
                    tap "Ask Forge to explain this" there whenever you're ready.
                  </p>
                )}

                <button
                  onClick={handleRetakeNewTopic}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 transition text-white py-2.5 rounded-lg text-sm"
                >
                  <RefreshCw size={14} /> Try Another Topic
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}