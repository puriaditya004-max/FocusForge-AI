// ===========================================================
// AI Mentor Controller — Forge AI Assistant
// ===========================================================
// Default: free shared Gemini key (GEMINI_API_KEY in .env)
// Optional: student's own Anthropic API key (BYOK), saved on
//           User.mentorApiKey via Settings page
//
// If the student's own key fails for any reason (invalid,
// expired, rate-limited), we silently fall back to the free
// Gemini tier so the chat never breaks — but we tell the
// student in the reply so they know to check their key.
//
// v2 — Forge AI Assistant:
//   - `mode` param on /message: "chat" | "doubt" | "planner"
//     changes how the mentor responds (planner mode is grounded
//     in the student's REAL pending tasks + current roadmap item,
//     not a generic answer)
//   - GET /recommendations: replaces the old hardcoded/dummy
//     "Smart Insights" — now built from the student's real
//     focus-session history, with an AI-written blurb layered
//     on top. If the AI call fails, we still return real,
//     data-only insights (never fall back to fake copy).
//   - POST /voice-command: used by the global "Hey Forge"
//     floating widget — decides chat vs actionable planning
//     command and can create real Task rows.
//
// v3 — Doubt Solver with image/PDF upload:
//   sendMessage now accepts an optional `file` field:
//     { mimeType: "image/png" | "application/pdf", dataBase64: "..." }
//   When a file is attached, we always use the free Gemini
//   tier directly (Gemini has strong native multimodal
//   support) — even if the student has their own Claude BYOK
//   key saved, since wiring up Claude's image/PDF format is
//   unnecessary complexity for what's the same feature.
//   Text-only messages still use BYOK-first-then-Gemini as before.
//   The voice-command endpoint below is untouched by this —
//   it never sends files, only transcripts.
//
// v4 — Weakness Detector:
//   GET /weakness-report combines real ExamAttempt scores and
//   real FocusSession focus scores per topic/subject into a
//   ranked list of weak spots. No invented topics — a topic
//   only appears if real attempt/session data exists for it.
//
// v5 — Quiz Generator:
//   POST /generate-quiz asks the AI for a strict-JSON multiple
//   choice quiz on a topic the student names. Grading happens
//   on the frontend (same pattern as the Certificate Exam
//   feature — this is a self-study app, not a proctored exam).
//   POST /quiz-attempt saves the REAL result once the student
//   submits, and that result now also feeds into the Weakness
//   Detector as a third real signal (see getWeaknessReport).
// ===========================================================

const prisma = require("../config/db");
const logger = require("../utils/logger");

const GEMINI_MODEL = "gemini-2.5-flash"; // gemini-2.0-flash was moved to a 0-quota free tier bucket by Google — use 2.5
const CLAUDE_MODEL = "claude-haiku-4-5-20251001"; // cheapest Claude model, good fit for BYOK chat
const HISTORY_LIMIT = 10; // last N messages sent as context, per user preference
const MAX_FILE_BYTES = 6 * 1024 * 1024; // ~6MB decoded, generous for a photo of a notebook page

// ---------------------------------------------------------
// Helper: call free Gemini API (default tier)
// `file`, if provided, is attached only to the LATEST user turn.
// ---------------------------------------------------------
async function callGemini(systemPrompt, historyMessages, file) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing in .env");
  }

  const lastIndex = historyMessages.length - 1;

  const contents = historyMessages.map((m, idx) => {
    const parts = [{ text: m.content }];
    const isLastUserTurn = idx === lastIndex && m.role !== "MENTOR";
    if (isLastUserTurn && file) {
      parts.push({ inline_data: { mime_type: file.mimeType, data: file.dataBase64 } });
    }
    return {
      role: m.role === "MENTOR" ? "model" : "user",
      parts,
    };
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!reply) {
    throw new Error("Gemini returned an empty response");
  }

  return reply;
}

// ---------------------------------------------------------
// Helper: call student's own Anthropic (Claude) API key
// Text-only — file-based doubts always go through Gemini instead.
// ---------------------------------------------------------
async function callClaude(apiKey, systemPrompt, historyMessages) {
  const messages = historyMessages.map((m) => ({
    role: m.role === "MENTOR" ? "assistant" : "user",
    content: m.content,
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const reply = data?.content?.[0]?.text;

  if (!reply) {
    throw new Error("Claude returned an empty response");
  }

  return reply;
}

// ---------------------------------------------------------
// Shared: hybrid call — student's BYOK key first, else Gemini.
// If a `file` is passed, we skip BYOK entirely and go straight
// to Gemini, since that's where multimodal support lives.
// The voice-command handler below never passes a file, so its
// behavior is completely unchanged by this addition.
// Returns { text, usedFallback }
// ---------------------------------------------------------
async function callMentorModel(user, systemPrompt, historyForApi, file) {
  let usedFallback = false;
  let replyText;

  if (file) {
    replyText = await callGemini(systemPrompt, historyForApi, file);
    return { text: replyText, usedFallback: false };
  }

  if (user.mentorApiKey) {
    try {
      replyText = await callClaude(user.mentorApiKey, systemPrompt, historyForApi);
    } catch (byokError) {
      logger.error("BYOK Claude key failed, falling back to Gemini:", byokError.message);
      usedFallback = true;
      replyText = await callGemini(systemPrompt, historyForApi, null);
    }
  } else {
    replyText = await callGemini(systemPrompt, historyForApi, null);
  }

  return { text: replyText, usedFallback };
}

// ---------------------------------------------------------
// Build the mentor's personality/context prompt.
// mode: "chat" (default) | "doubt" | "planner"
// extraContext: string injected only for "planner" mode —
//               the student's real pending tasks + roadmap.
// hasFile: true when a photo/PDF is attached in doubt mode.
// ---------------------------------------------------------
function buildSystemPrompt(user, mode, extraContext, hasFile) {
  const base = `You are Forge AI, the mentor inside FocusForge AI, a student self-study tracking app.
The student you're talking to is named ${user.name}. Their current level is ${user.level}, XP is ${user.xp}, and their current study streak is ${user.currentStreak} days.
Be warm, encouraging, and practical — like a supportive study mentor, not a generic chatbot.`;

  if (mode === "doubt") {
    const fileNote = hasFile
      ? " The student has attached a photo or PDF of their doubt (a textbook page, handwritten question, or notes) — read it carefully first, then explain."
      : "";
    return `${base}
The student has a DOUBT they need explained.${fileNote} Break the concept down step by step, use one simple real-world example, and end by checking if they'd like a follow-up example or a related practice question. Keep it clear over clever.`;
  }

  if (mode === "planner") {
    return `${base}
The student wants a STUDY PLAN. Here is their real, current data — build the plan around this, don't invent generic tasks:
${extraContext || "(No pending tasks or roadmap data found — suggest they add tasks in Today's Plan first, then offer a general study-habit tip instead.)"}
Give a short, ordered plan (numbered steps) for what to focus on next, grounded only in the data above. Keep it realistic for one day unless they ask for a week.`;
  }

  return `${base}
Keep replies concise (2-5 sentences) unless the student asks for a detailed explanation or step-by-step plan.
You can help with: study planning, explaining academic concepts simply, motivation, and reviewing their progress patterns.`;
}

// ---------------------------------------------------------
// Helper: pull the student's real pending tasks + current
// roadmap item, formatted as plain text for the prompt.
// Used only by planner mode.
// ---------------------------------------------------------
async function getPlannerContext(userId) {
  const [pendingTasks, currentRoadmapItem] = await Promise.all([
    prisma.task.findMany({
      where: { userId, completed: false },
      orderBy: { date: "asc" },
      take: 6,
    }),
    prisma.roadmapItem.findFirst({
      where: { userId, status: "IN_PROGRESS" },
      orderBy: { weekNumber: "asc" },
    }),
  ]);

  const lines = [];

  if (pendingTasks.length > 0) {
    lines.push("Pending tasks:");
    pendingTasks.forEach((t) => {
      lines.push(`- [${t.priority}] ${t.title}${t.category ? ` (${t.category})` : ""}`);
    });
  }

  if (currentRoadmapItem) {
    lines.push(`\nCurrent roadmap focus: ${currentRoadmapItem.title} (${currentRoadmapItem.monthLabel}, Week ${currentRoadmapItem.weekNumber}).`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------
// POST /api/mentor/message
// Body: { message: string, mode?: "chat" | "doubt" | "planner",
//         file?: { mimeType, dataBase64 } }
// ---------------------------------------------------------
async function sendMessage(req, res) {
  try {
    const userId = req.user.userId; // NOT req.user.id — known gotcha
    const { message, mode, file } = req.body;
    const safeMode = ["chat", "doubt", "planner"].includes(mode) ? mode : "chat";

    const hasText = message && message.trim();
    const hasFile = !!(file && file.mimeType && file.dataBase64);

    if (!hasText && !hasFile) {
      return res.status(400).json({ error: "Please type a doubt or attach a photo/PDF." });
    }

    if (hasFile) {
      const allowedMimes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
      if (!allowedMimes.includes(file.mimeType)) {
        return res.status(400).json({ error: "Only PNG, JPG, WEBP images or PDF files are supported." });
      }
      const approxBytes = (file.dataBase64.length * 3) / 4;
      if (approxBytes > MAX_FILE_BYTES) {
        return res.status(400).json({ error: "File is too large. Please attach something under 6MB." });
      }
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const textToSave =
      (hasText ? message.trim() : "(Sent a photo/PDF without extra text)") +
      (hasFile ? ` [📎 Attached ${file.mimeType === "application/pdf" ? "PDF" : "photo"}]` : "");

    await prisma.aiMentorMessage.create({
      data: { userId, role: "USER", content: textToSave },
    });

    const recentMessages = await prisma.aiMentorMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    });
    const historyForApi = recentMessages.reverse();

    const extraContext = safeMode === "planner" ? await getPlannerContext(userId) : null;
    const systemPrompt = buildSystemPrompt(user, safeMode, extraContext, hasFile);

    const { text: replyTextRaw, usedFallback } = await callMentorModel(
      user,
      systemPrompt,
      historyForApi,
      hasFile ? file : null
    );
    let replyText = replyTextRaw;

    if (usedFallback) {
      replyText += "\n\n_(Note: your saved API key didn't work, so I used the free tier for this reply — check your key in Settings.)_";
    }

    const savedReply = await prisma.aiMentorMessage.create({
      data: { userId, role: "MENTOR", content: replyText },
    });

    return res.status(200).json({
      id: savedReply.id,
      role: "mentor",
      text: replyText,
      time: savedReply.createdAt,
    });
  } catch (error) {
    logger.error("AI Mentor sendMessage error:", error);
    return res.status(500).json({ error: "Mentor is unavailable right now, please try again." });
  }
}

// ---------------------------------------------------------
// GET /api/mentor/history
// ---------------------------------------------------------
async function getHistory(req, res) {
  try {
    const userId = req.user.userId;
    const messages = await prisma.aiMentorMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    const formatted = messages.map((m) => ({
      id: m.id,
      role: m.role === "MENTOR" ? "mentor" : "user",
      text: m.content,
      time: m.createdAt,
    }));
    return res.status(200).json({ results: formatted });
  } catch (error) {
    logger.error("AI Mentor getHistory error:", error);
    return res.status(500).json({ error: "Could not load chat history" });
  }
}

// ---------------------------------------------------------
// GET /api/mentor/recommendations
// ---------------------------------------------------------
async function getRecommendations(req, res) {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const since = new Date();
    since.setDate(since.getDate() - 14);

    const sessions = await prisma.focusSession.findMany({
      where: { userId, startedAt: { gte: since } },
      orderBy: { startedAt: "asc" },
    });

    const currentRoadmapItem = await prisma.roadmapItem.findFirst({
      where: { userId, status: "IN_PROGRESS" },
      orderBy: { weekNumber: "asc" },
    });

    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);

    const thisWeek = sessions.filter((s) => new Date(s.startedAt) >= weekAgo);
    const lastWeek = sessions.filter((s) => new Date(s.startedAt) >= twoWeeksAgo && new Date(s.startedAt) < weekAgo);

    const avg = (arr) => (arr.length ? arr.reduce((sum, s) => sum + s.focusScore, 0) / arr.length : null);
    const thisWeekAvg = avg(thisWeek);
    const lastWeekAvg = avg(lastWeek);

    const byDay = {};
    sessions.forEach((s) => {
      const day = new Date(s.startedAt).getDay();
      byDay[day] = (byDay[day] || 0) + (s.durationSec || 0);
    });
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let weakestDay = null;
    if (Object.keys(byDay).length >= 3) {
      const entries = Object.entries(byDay);
      const minEntry = entries.reduce((a, b) => (a[1] < b[1] ? a : b));
      weakestDay = dayNames[Number(minEntry[0])];
    }

    const insights = [];

    if (thisWeekAvg !== null && lastWeekAvg !== null) {
      const deltaPct = Math.round(((thisWeekAvg - lastWeekAvg) / Math.max(lastWeekAvg, 1)) * 100);
      insights.push({
        type: deltaPct >= 0 ? "positive" : "warning",
        title: deltaPct >= 0 ? "You're improving" : "Focus dipped this week",
        text: `Focus score is ${Math.abs(deltaPct)}% ${deltaPct >= 0 ? "up" : "down"} compared to last week (${Math.round(lastWeekAvg)} → ${Math.round(thisWeekAvg)}).`,
      });
    }

    if (weakestDay) {
      insights.push({
        type: "warning",
        title: `${weakestDay} dip detected`,
        text: `Your study time is consistently lowest on ${weakestDay}s over the last 2 weeks. Try a shorter, lighter session instead of skipping entirely.`,
      });
    }

    if (currentRoadmapItem) {
      insights.push({
        type: "milestone",
        title: "Next milestone",
        text: `Finish "${currentRoadmapItem.title}" (${currentRoadmapItem.monthLabel}, Week ${currentRoadmapItem.weekNumber}) to keep your roadmap on track.`,
      });
    }

    if (insights.length === 0) {
      insights.push({
        type: "milestone",
        title: "Not enough data yet",
        text: "Complete a few Focus Sessions and Forge AI will start giving you personalized insights here.",
      });
    }

    return res.status(200).json({ results: insights });
  } catch (error) {
    logger.error("AI Mentor getRecommendations error:", error);
    return res.status(500).json({ error: "Could not load recommendations" });
  }
}

// ---------------------------------------------------------
// Global Forge Voice Widget support
// ---------------------------------------------------------
function buildVoiceCommandPrompt(user) {
  return `You are Forge AI, the voice assistant inside FocusForge AI, a student self-study tracking app.
The student is named ${user.name}.

You will receive one spoken message from the student (already transcribed from voice). Decide which case it is:

CASE 1 — The student is asking you to plan, schedule, or add study tasks (e.g. "set my day study routine on Python", "plan today for DSA", "add a task to revise OOP"). Respond with ONLY this exact JSON shape, nothing else, no markdown fences:
{"action":"create_tasks","reply":"<a short, warm, SPOKEN confirmation sentence, 1-2 sentences>","tasks":[{"title":"<short task title>","subject":"<topic/subject>","priority":"High"|"Medium"|"Low"}]}
Create between 2 and 6 realistic, ordered tasks that make sense as a study routine for what the student asked for.

CASE 2 — Anything else (chit-chat, a question, motivation, a doubt, general conversation). Respond with ONLY this exact JSON shape, nothing else, no markdown fences:
{"action":"chat","reply":"<your natural, warm SPOKEN reply, 2-4 sentences>"}

Never include any text outside the single JSON object. Never wrap it in markdown code fences.`;
}

function toPrismaPriority(priority) {
  if (!priority) return "MEDIUM";
  return priority.toUpperCase();
}

function safeParseVoiceJson(raw) {
  try {
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------
// POST /api/mentor/voice-command
// ---------------------------------------------------------
async function handleVoiceCommand(req, res) {
  try {
    const userId = req.user.userId;
    const { transcript } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: "No speech transcript received" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const trimmedTranscript = transcript.trim();

    await prisma.aiMentorMessage.create({
      data: { userId, role: "USER", content: trimmedTranscript },
    });

    const systemPrompt = buildVoiceCommandPrompt(user);

    const { text: rawReply } = await callMentorModel(
      user,
      systemPrompt,
      [{ role: "USER", content: trimmedTranscript }],
      null
    );

    const parsed = safeParseVoiceJson(rawReply);

    if (!parsed || !parsed.reply) {
      const fallbackReply = rawReply || "Sorry, I didn't quite catch that — could you try again?";
      const saved = await prisma.aiMentorMessage.create({
        data: { userId, role: "MENTOR", content: fallbackReply },
      });
      return res.status(200).json({
        id: saved.id,
        reply: fallbackReply,
        action: "chat",
        tasksCreated: 0,
      });
    }

    let tasksCreated = 0;

    if (parsed.action === "create_tasks" && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
      const safeTasks = parsed.tasks.slice(0, 6);
      for (const t of safeTasks) {
        if (!t.title || !t.title.trim()) continue;
        await prisma.task.create({
          data: {
            userId,
            title: t.title.trim(),
            category: t.subject || null,
            priority: toPrismaPriority(t.priority),
          },
        });
        tasksCreated++;
      }
    }

    const savedReply = await prisma.aiMentorMessage.create({
      data: { userId, role: "MENTOR", content: parsed.reply },
    });

    return res.status(200).json({
      id: savedReply.id,
      reply: parsed.reply,
      action: parsed.action === "create_tasks" ? "create_tasks" : "chat",
      tasksCreated,
    });
  } catch (error) {
    logger.error("Forge voice command error:", error);
    return res.status(500).json({ error: "Forge couldn't process that, please try again." });
  }
}

// ---------------------------------------------------------
// Weakness Detector
// ---------------------------------------------------------
// Combines THREE real signals — nothing invented:
//   1. ExamAttempt.score per topic (certificate exam performance)
//   2. FocusSession.focusScore per subject (engagement quality)
//   3. QuizAttempt.scorePercent per topic (Quiz Generator results)
// A topic only shows up here if there's real data behind it.
// ---------------------------------------------------------
async function getWeaknessReport(req, res) {
  try {
    const userId = req.user.userId;

    const [examAttempts, focusSessions, quizAttempts] = await Promise.all([
      prisma.examAttempt.findMany({ where: { userId, score: { not: null } } }),
      prisma.focusSession.findMany({ where: { userId, subject: { not: null } } }),
      prisma.quizAttempt.findMany({ where: { userId } }),
    ]);

    const examByTopic = {};
    examAttempts.forEach((a) => {
      if (!examByTopic[a.topic]) examByTopic[a.topic] = [];
      examByTopic[a.topic].push(a.score);
    });
    const examWeaknesses = Object.entries(examByTopic).map(([topic, scores]) => ({
      topic,
      avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      attempts: scores.length,
      source: "exam",
    }));

    const quizByTopic = {};
    quizAttempts.forEach((a) => {
      if (!quizByTopic[a.topic]) quizByTopic[a.topic] = [];
      quizByTopic[a.topic].push(a.scorePercent);
    });
    const quizWeaknesses = Object.entries(quizByTopic).map(([topic, scores]) => ({
      topic,
      avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      attempts: scores.length,
      source: "quiz",
    }));

    const focusBySubject = {};
    focusSessions.forEach((s) => {
      if (!focusBySubject[s.subject]) focusBySubject[s.subject] = [];
      focusBySubject[s.subject].push(s.focusScore);
    });
    const focusWeaknesses = Object.entries(focusBySubject).map(([subject, scores]) => ({
      topic: subject,
      avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      attempts: scores.length,
      source: "focus",
    }));

    // Merge — priority when the same topic appears in multiple signals:
    // exam > quiz > focus (a direct test score beats a quiz, which beats
    // engagement-only data).
    const merged = {};
    focusWeaknesses.forEach((w) => { merged[w.topic] = w; });
    quizWeaknesses.forEach((w) => { merged[w.topic] = w; });
    examWeaknesses.forEach((w) => { merged[w.topic] = w; });

    const allTopics = Object.values(merged);

    if (allTopics.length === 0) {
      return res.status(200).json({
        hasData: false,
        weakTopics: [],
        message: "Not enough data yet — take a Quiz, complete a certificate exam, or tag Focus Sessions with a subject, and Forge AI will detect real weak spots here.",
      });
    }

    const threshold = (t) => (t.source === "focus" ? 65 : 70);
    const sourceLabel = { exam: "exam attempt(s)", quiz: "quiz attempt(s)", focus: "focus session(s)" };

    const weakTopics = allTopics
      .filter((t) => t.avgScore < threshold(t))
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 5)
      .map((t) => ({
        topic: t.topic,
        avgScore: t.avgScore,
        basedOn: `${t.attempts} ${sourceLabel[t.source]}`,
      }));

    const strongTopics = allTopics
      .filter((t) => t.avgScore >= threshold(t))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3)
      .map((t) => ({ topic: t.topic, avgScore: t.avgScore }));

    return res.status(200).json({ hasData: true, weakTopics, strongTopics });
  } catch (error) {
    logger.error("AI Mentor getWeaknessReport error:", error);
    return res.status(500).json({ error: "Could not analyze weaknesses right now." });
  }
}

// ---------------------------------------------------------
// Quiz Generator
// ---------------------------------------------------------
// POST /api/mentor/generate-quiz
// Body: { topic: string, numQuestions?: number (default 5, max 10) }
// AI returns strict JSON — grading happens on the frontend,
// same trust model as the existing Certificate Exam feature.
// ---------------------------------------------------------
function safeParseQuizJson(raw) {
  try {
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function generateQuiz(req, res) {
  try {
    const userId = req.user.userId;
    const { topic, numQuestions } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: "Please provide a topic for the quiz." });
    }

    const safeCount = Math.min(Math.max(Number(numQuestions) || 5, 3), 10);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const systemPrompt = `You are Forge AI's Quiz Generator for FocusForge AI, a student self-study app.
Generate exactly ${safeCount} multiple-choice questions on the topic: "${topic.trim()}".
Difficulty should suit a self-studying student learning this topic — not trivial, not PhD-level.

Respond with ONLY this exact JSON shape, nothing else, no markdown fences:
{"questions":[{"question":"<question text>","options":["<A>","<B>","<C>","<D>"],"correctIndex":<0-3>,"explanation":"<1 sentence why this is correct>"}]}

Each question must have exactly 4 options and exactly one correct answer. Never include any text outside the single JSON object.`;

    const { text: rawReply } = await callMentorModel(
      user,
      systemPrompt,
      [{ role: "USER", content: `Generate the quiz on: ${topic.trim()}` }],
      null
    );

    const parsed = safeParseQuizJson(rawReply);
    if (!parsed) {
      return res.status(502).json({ error: "Forge couldn't generate a valid quiz this time — please try again." });
    }

    return res.status(200).json({ topic: topic.trim(), questions: parsed.questions });
  } catch (error) {
    logger.error("Quiz generateQuiz error:", error);
    return res.status(500).json({ error: "Could not generate quiz right now." });
  }
}

// ---------------------------------------------------------
// POST /api/mentor/quiz-attempt
// Body: { topic, correctCount, totalQuestions }
// Saves the REAL result — this also becomes a signal in
// getWeaknessReport above.
// ---------------------------------------------------------
async function submitQuizAttempt(req, res) {
  try {
    const userId = req.user.userId;
    const { topic, correctCount, totalQuestions } = req.body;

    if (!topic || correctCount === undefined || !totalQuestions) {
      return res.status(400).json({ error: "topic, correctCount, and totalQuestions are required." });
    }

    const scorePercent = Math.round((correctCount / totalQuestions) * 100);

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        topic: topic.trim(),
        correctCount: Number(correctCount),
        totalQuestions: Number(totalQuestions),
        scorePercent,
      },
    });

    return res.status(201).json({ attempt });
  } catch (error) {
    logger.error("Quiz submitQuizAttempt error:", error);
    return res.status(500).json({ error: "Could not save quiz result." });
  }
}

module.exports = {
  sendMessage,
  getHistory,
  getRecommendations,
  handleVoiceCommand,
  getWeaknessReport,
  generateQuiz,
  submitQuizAttempt,
};