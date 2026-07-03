// ===========================================================
// AI Mentor Controller — Hybrid System
// ===========================================================
// Default: free shared Gemini key (GEMINI_API_KEY in .env)
// Optional: student's own Anthropic API key (BYOK), saved on
//           User.mentorApiKey via Settings page
//
// If the student's own key fails for any reason (invalid,
// expired, rate-limited), we silently fall back to the free
// Gemini tier so the chat never breaks — but we tell the
// student in the reply so they know to check their key.
// ===========================================================

const prisma = require("../config/db");

const GEMINI_MODEL = "gemini-2.5-flash"; // gemini-2.0-flash was moved to a 0-quota free tier bucket by Google — use 2.5
const CLAUDE_MODEL = "claude-haiku-4-5-20251001"; // cheapest Claude model, good fit for BYOK chat
const HISTORY_LIMIT = 10; // last N messages sent as context, per user preference

// ---------------------------------------------------------
// Helper: call free Gemini API (default tier)
// ---------------------------------------------------------
async function callGemini(systemPrompt, historyMessages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing in .env");
  }

  // Gemini expects "contents" array with role: "user" | "model"
  const contents = historyMessages.map((m) => ({
    role: m.role === "MENTOR" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

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
// ---------------------------------------------------------
async function callClaude(apiKey, systemPrompt, historyMessages) {
  // Anthropic expects role: "user" | "assistant"
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
// Build the mentor's personality/context prompt
// ---------------------------------------------------------
function buildSystemPrompt(user) {
  return `You are the AI Mentor inside FocusForge AI, a student self-study tracking app.
The student you're talking to is named ${user.name}. Their current level is ${user.level}, XP is ${user.xp}, and their current study streak is ${user.currentStreak} days.
Be warm, encouraging, and practical — like a supportive study mentor, not a generic chatbot.
Keep replies concise (2-5 sentences) unless the student asks for a detailed explanation or step-by-step plan.
You can help with: study planning, explaining academic concepts simply, motivation, and reviewing their progress patterns.`;
}

// ---------------------------------------------------------
// POST /api/mentor/message
// Body: { message: string }
// ---------------------------------------------------------
async function sendMessage(req, res) {
  try {
    const userId = req.user.userId; // NOT req.user.id — known gotcha
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 1. Save the student's message first
    await prisma.aiMentorMessage.create({
      data: { userId, role: "USER", content: message.trim() },
    });

    // 2. Pull last N messages (including the one we just saved) for context
    const recentMessages = await prisma.aiMentorMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    });
    const historyForApi = recentMessages.reverse(); // oldest -> newest

    const systemPrompt = buildSystemPrompt(user);

    let replyText;
    let usedFallback = false;

    // 3. Hybrid decision: student's own key (BYOK) vs free Gemini
    if (user.mentorApiKey) {
      try {
        replyText = await callClaude(user.mentorApiKey, systemPrompt, historyForApi);
      } catch (byokError) {
        console.error("BYOK Claude key failed, falling back to Gemini:", byokError.message);
        usedFallback = true;
        replyText = await callGemini(systemPrompt, historyForApi);
      }
    } else {
      replyText = await callGemini(systemPrompt, historyForApi);
    }

    // 4. If we silently fell back, let the student know (appended, not scary)
    if (usedFallback) {
      replyText += "\n\n_(Note: your saved API key didn't work, so I used the free tier for this reply — check your key in Settings.)_";
    }

    // 5. Save mentor's reply
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
    console.error("AI Mentor sendMessage error:", error);
    return res.status(500).json({ error: "Mentor is unavailable right now, please try again." });
  }
}

// ---------------------------------------------------------
// GET /api/mentor/history
// Returns full chat history for the logged-in student
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
    console.error("AI Mentor getHistory error:", error);
    return res.status(500).json({ error: "Could not load chat history" });
  }
}

module.exports = { sendMessage, getHistory };