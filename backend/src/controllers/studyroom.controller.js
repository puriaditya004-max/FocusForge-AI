// ===========================================================
// studyroom.controller.js — Study Room REST endpoints
// ===========================================================
// Real-time messaging itself happens over Socket.io
// (sockets/studyroom.socket.js). These REST endpoints handle
// everything that isn't "live": listing rooms, creating a
// custom room, joining a room (persisted membership), and
// loading a room's message history when a student opens it.
// ===========================================================

const prisma = require("../config/db");

// ---------------------------------------------------------
// GET /api/studyroom/rooms
// Returns: global room, all subject rooms, and any custom
// rooms the logged-in student has joined (via RoomMember).
// ---------------------------------------------------------
const listRooms = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Global + subject rooms are visible to everyone
    const publicRooms = await prisma.room.findMany({
      where: {
        OR: [{ isGlobal: true }, { subject: { not: null } }],
      },
      orderBy: { createdAt: "asc" },
    });

    // Custom (student-created) rooms this student has joined
    const joinedMemberships = await prisma.roomMember.findMany({
      where: { userId },
      include: { room: true },
    });
    const joinedCustomRooms = joinedMemberships
      .map((m) => m.room)
      .filter((r) => !r.isGlobal && !r.subject);

    // Merge, de-duplicate by id
    const allRoomsMap = new Map();
    [...publicRooms, ...joinedCustomRooms].forEach((r) => allRoomsMap.set(r.id, r));

    // Attach a live-ish member count (based on RoomMember, not online status)
    const rooms = await Promise.all(
      Array.from(allRoomsMap.values()).map(async (room) => {
        const memberCount = await prisma.roomMember.count({ where: { roomId: room.id } });
        return {
          id: room.id,
          name: room.name,
          subject: room.subject,
          isGlobal: room.isGlobal,
          createdById: room.createdById,
          memberCount,
        };
      })
    );

    return res.status(200).json({ results: rooms });
  } catch (err) {
    console.error("listRooms error:", err);
    return res.status(500).json({ error: "Failed to load rooms" });
  }
};

// ---------------------------------------------------------
// POST /api/studyroom/rooms
// Body: { name: string }
// Creates a custom room, and auto-joins the creator to it.
// ---------------------------------------------------------
const createRoom = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Room name is required" });
    }

    const room = await prisma.room.create({
      data: {
        name: name.trim(),
        isGlobal: false,
        subject: null,
        createdById: userId,
      },
    });

    // Creator automatically becomes a member of their own room
    await prisma.roomMember.create({
      data: { roomId: room.id, userId },
    });

    return res.status(201).json({
      id: room.id,
      name: room.name,
      subject: room.subject,
      isGlobal: room.isGlobal,
      createdById: room.createdById,
      memberCount: 1,
    });
  } catch (err) {
    console.error("createRoom error:", err);
    return res.status(500).json({ error: "Failed to create room" });
  }
};

// ---------------------------------------------------------
// POST /api/studyroom/rooms/:roomId/join
// Manual join — no auto-join anywhere else in the app.
// ---------------------------------------------------------
const joinRoom = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Idempotent join — if already a member, just return success
    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      update: {},
      create: { roomId, userId },
    });

    return res.status(200).json({ message: "Joined room", roomId });
  } catch (err) {
    console.error("joinRoom error:", err);
    return res.status(500).json({ error: "Failed to join room" });
  }
};

// ---------------------------------------------------------
// GET /api/studyroom/rooms/:roomId/messages
// Loads chat history for a room (Socket.io handles new
// messages live; this is just the initial load).
// ---------------------------------------------------------
const getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;

    const messages = await prisma.studyRoomMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } } },
    });

    const formatted = messages.map((m) => ({
      id: m.id,
      userId: m.userId,
      userName: m.user.name,
      message: m.message,
      time: m.createdAt,
    }));

    return res.status(200).json({ results: formatted });
  } catch (err) {
    console.error("getRoomMessages error:", err);
    return res.status(500).json({ error: "Failed to load messages" });
  }
};

module.exports = { listRooms, createRoom, joinRoom, getRoomMessages };