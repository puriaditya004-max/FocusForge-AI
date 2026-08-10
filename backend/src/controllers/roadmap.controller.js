// ---------------------------------------------------------
// roadmap.controller.js — Smart Timetable
// ---------------------------------------------------------
// v2 — AI-Generated Smart Timetable:
//   Previously every student got the SAME fixed 25-week
//   AIML/Software-Engineer curriculum, auto-seeded on first
//   visit. That's now removed — a student's Smart Timetable
//   starts EMPTY until they generate one via
//   POST /api/roadmap/generate (student types or speaks a
//   request like "2 month plan for NEET Biology" and Gemini
//   builds a real, on-syllabus week-by-week plan).
//   Regenerating REPLACES the student's current plan.
//
//   GET /api/roadmap/suggest-today (used by Today's Plan) picks
//   topics from the student's current plan to fill a target
//   number of study hours. This is a deterministic, rule-based
//   picker (NOT an LLM call) — instant, free, 100% reliable.
//   Swapping in real AI-ranked suggestions later (e.g.
//   prioritizing weak topics from getWeaknessReport) is a
//   drop-in change to pickTopicsForToday() below.
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");
const { recordGeminiCall } = require("../utils/aiUsage");
const { isUnsafeAiOutput, SAFE_FALLBACK_REPLY } = require("../utils/aiSafety");

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_WEEKS = 24; // ~6 months — caps token cost & keeps generation reliable
const DEFAULT_WEEKS = 8;
const DEFAULT_SESSION_MINUTES = 90; // used by suggestToday's greedy picker

// Helper: reshape a Prisma roadmap item -> frontend format
const formatItem = (item) => ({
  week: item.weekNumber,
  month: item.monthLabel,
  monthNumber: item.monthNumber,
  topic: item.title,
  tools: item.tools || "",
  hours: item.hours || "",
  project: item.project || "",
  status: item.status,
});

// ---------------------------------------------------------
// GET /api/roadmap
// Returns the student's current plan (possibly empty — the
// frontend shows a "generate your first plan" prompt in that
// case; this no longer auto-seeds a fixed curriculum).
// ---------------------------------------------------------
const getRoadmap = async (req, res) => {
  try {
    const userId = req.user.userId;
    const items = await prisma.roadmapItem.findMany({
      where: { userId },
      orderBy: { weekNumber: "asc" },
    });
    res.status(200).json(items.map(formatItem));
  } catch (err) {
    logger.error("getRoadmap error:", err);
    res.status(500).json({ message: "Failed to fetch roadmap" });
  }
};

// ---------------------------------------------------------
// PATCH /api/roadmap/:week/status
// ---------------------------------------------------------
const updateWeekStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const weekNumber = parseInt(req.params.week, 10);
    const { status } = req.body;

    const validStatuses = ["UPCOMING", "IN_PROGRESS", "COMPLETED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const existing = await prisma.roadmapItem.findFirst({
      where: { userId, weekNumber },
    });
    if (!existing) {
      return res.status(404).json({ message: "Week not found" });
    }

    const updated = await prisma.roadmapItem.update({
      where: { id: existing.id },
      data: { status },
    });

    res.status(200).json(formatItem(updated));
  } catch (err) {
    logger.error("updateWeekStatus error:", err);
    res.status(500).json({ message: "Failed to update week status" });
  }
};

// ---------------------------------------------------------
// AI generation — POST /api/roadmap/generate
// ---------------------------------------------------------
async function callGeminiForPlan(systemPrompt, userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing in .env");
  }

  const safetySettings = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      safetySettings,
    }),
  });

  recordGeminiCall();

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();

  const blockReason = data?.promptFeedback?.blockReason;
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (blockReason || finishReason === "SAFETY") {
    logger.warn("Gemini blocked a roadmap generation for safety:", { blockReason, finishReason });
    return null;
  }

  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    throw new Error("Gemini returned an empty response");
  }
  return reply;
}

function safeParsePlanJson(raw) {
  try {
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.weeks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function generateRoadmap(req, res) {
  try {
    const userId = req.user.userId;
    const { prompt } = req.body;

    const systemPrompt = `You are Forge AI's Smart Timetable generator inside FocusForge AI, a student self-study app used in India.
A student describes, in their own words, what study plan they want. Turn it into a week-by-week study plan.

Rules:
- If the student did not mention a duration, use ${DEFAULT_WEEKS} weeks.
- Never plan more than ${MAX_WEEKS} weeks even if asked for longer.
- If the student did not mention daily study hours, use "6-8 Hrs".
- Group weeks into logical phases ("months") and give each phase a short name.
- Stay strictly on-syllabus for the stated subject/exam (real NCERT/board/NEET/JEE-aligned topics, or real topics for the stated professional course — never invent unrelated topics).
- Every week needs one concrete, specific topic — not vague filler.

Respond with ONLY this exact JSON shape, nothing else, no markdown fences, no commentary:
{"topic":"<short 2-6 word plan name>","weeks":[{"week":1,"monthNumber":1,"monthLabel":"<Topic> — Month 1: <phase name>","title":"<specific topic for this week>","tools":"<resources/tools for this week>","hours":"<daily hours, e.g. 6-8 Hrs>","goal":"<one concrete weekly milestone>"}]}`;

    const rawReply = await callGeminiForPlan(systemPrompt, prompt.trim());

    if (rawReply === null) {
      return res.status(200).json({
        error: "That request couldn't be processed safely — please rephrase and try again.",
      });
    }

    const parsed = safeParsePlanJson(rawReply);
    if (!parsed || parsed.weeks.length === 0) {
      return res.status(502).json({
        error: "Forge AI couldn't generate a valid plan this time — please try again, maybe with a simpler request.",
      });
    }

    const combinedText = parsed.weeks
      .map((w) => `${w.title || ""} ${w.tools || ""} ${w.goal || ""}`)
      .join(" ");
    if (isUnsafeAiOutput(combinedText)) {
      logger.warn("generateRoadmap: AI output flagged by safety filter", { userId });
      return res.status(200).json({ error: SAFE_FALLBACK_REPLY });
    }

    const topic = String(parsed.topic || "Your Plan").slice(0, 100);
    const weeks = parsed.weeks.slice(0, MAX_WEEKS);

    // Regenerating REPLACES the student's current plan
    await prisma.roadmapItem.deleteMany({ where: { userId } });
    await prisma.roadmapItem.createMany({
      data: weeks.map((w, idx) => ({
        userId,
        weekNumber: idx + 1,
        monthNumber: Number(w.monthNumber) || 1,
        monthLabel: String(w.monthLabel || topic).slice(0, 200),
        title: String(w.title || "Study session").slice(0, 300),
        tools: w.tools ? String(w.tools).slice(0, 200) : null,
        hours: w.hours ? String(w.hours).slice(0, 50) : "6-8 Hrs",
        project: w.goal ? String(w.goal).slice(0, 200) : null,
      })),
    });

    const items = await prisma.roadmapItem.findMany({
      where: { userId },
      orderBy: { weekNumber: "asc" },
    });

    return res.status(201).json({
      topic,
      weeks: items.map(formatItem),
    });
  } catch (err) {
    logger.error("generateRoadmap error:", err);
    return res.status(500).json({ error: "Could not generate your plan right now — please try again." });
  }
}

// ---------------------------------------------------------
// GET /api/roadmap/suggest-today?hours=6
// Rule-based picker — see file header note above.
// ---------------------------------------------------------
function pickTopicsForToday(items, targetMinutes) {
  const pending = items
    .filter((i) => i.status !== "COMPLETED")
    .sort((a, b) => a.weekNumber - b.weekNumber);

  const picked = [];
  let used = 0;
  for (const item of pending) {
    if (used >= targetMinutes || picked.length >= 8) break;
    picked.push(item);
    used += DEFAULT_SESSION_MINUTES;
  }
  return picked;
}

async function suggestToday(req, res) {
  try {
    const userId = req.user.userId;
    const hours = Math.min(Math.max(Number(req.query.hours) || 4, 1), 12);
    const targetMinutes = Math.round(hours * 60);

    const items = await prisma.roadmapItem.findMany({
      where: { userId },
      orderBy: { weekNumber: "asc" },
    });

    if (items.length === 0) {
      return res.status(200).json({
        suggestions: [],
        message: "Generate a Smart Timetable first — then Forge AI can suggest today's topics from it.",
      });
    }

    const picked = pickTopicsForToday(items, targetMinutes);

    const suggestions = picked.map((item) => ({
      title: item.title,
      subject: item.monthLabel,
      duration: `${DEFAULT_SESSION_MINUTES} min`,
      priority: "Medium",
    }));

    res.status(200).json({ suggestions });
  } catch (err) {
    logger.error("suggestToday error:", err);
    res.status(500).json({ message: "Could not suggest a plan right now" });
  }
}

module.exports = {
  getRoadmap,
  updateWeekStatus,
  generateRoadmap,
  suggestToday,
};
