// ---------------------------------------------------------
// penalty.controller.js — Strike / Penalty system
// ---------------------------------------------------------
// NOTE: Automatic penalty creation (detecting a missed task,
// a broken streak, etc.) is NOT implemented yet — that needs
// its own detection logic (similar to badge auto-unlock) and
// will be a separate future step. For now this handles
// reading existing penalties and marking them as redeemed.
// ---------------------------------------------------------
const prisma = require("../config/db");
const logger = require("../utils/logger");

// Fixed redemption challenges — static data, no DB table needed
const REDEMPTION_CHALLENGES = [
  {
    id: 1,
    title: "Complete tomorrow's full task list with 90%+ focus score",
    reward: "Clears 1 penalty + refunds 20 XP",
    forSeverity: "orange",
  },
  {
    id: 2,
    title: "Study 3 days in a row without missing a single task",
    reward: "Clears streak_break penalty + restores partial streak",
    forSeverity: "red",
  },
];

const formatEvent = (e) => ({
  id: e.id,
  date: new Date(e.date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
  type: e.type.toLowerCase(),
  title: e.title,
  severity: e.severity.toLowerCase(),
  xpDeducted: e.xpDeducted,
  resolved: e.resolved,
  redemptionDone: e.redemptionDone,
});

// GET /api/penalties
const getPenalties = async (req, res) => {
  try {
    const userId = req.user.userId;

    const events = await prisma.penaltyEvent.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });

    const unresolved = events.filter((e) => !e.resolved);

    let strikeLevel = "none";
    if (unresolved.some((e) => e.severity === "RED")) strikeLevel = "red";
    else if (unresolved.some((e) => e.severity === "ORANGE")) strikeLevel = "orange";
    else if (unresolved.some((e) => e.severity === "YELLOW")) strikeLevel = "yellow";

    const strikeCount = unresolved.length;
    const totalXpDeducted = events.reduce((sum, e) => sum + e.xpDeducted, 0);

    res.status(200).json({
      events: events.map(formatEvent),
      strikeLevel,
      strikeCount,
      totalXpDeducted,
      redemptionChallenges: REDEMPTION_CHALLENGES,
    });
  } catch (err) {
    logger.error("getPenalties error:", err);
    res.status(500).json({ message: "Failed to fetch penalties" });
  }
};

// PATCH /api/penalties/:id/redeem
const markRedeemed = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const existing = await prisma.penaltyEvent.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ message: "Penalty event not found" });
    }

    const updated = await prisma.penaltyEvent.update({
      where: { id },
      data: { resolved: true, redemptionDone: true },
    });

    res.status(200).json(formatEvent(updated));
  } catch (err) {
    logger.error("markRedeemed error:", err);
    res.status(500).json({ message: "Failed to update penalty event" });
  }
};

module.exports = {
  getPenalties,
  markRedeemed,
};