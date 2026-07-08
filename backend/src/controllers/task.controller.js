// ---------------------------------------------------------
// task.controller.js — CRUD logic for Today's Plan tasks
// ---------------------------------------------------------
const prisma = require("../config/db");

// Helper: convert frontend priority ("High","Medium","Low")
// to Prisma enum format ("HIGH","MEDIUM","LOW")
const toPrismaPriority = (priority) => {
  if (!priority) return "MEDIUM";
  return priority.toUpperCase();
};

// Helper: convert Prisma priority ("HIGH") back to frontend format ("High")
const toFrontendPriority = (priority) => {
  if (!priority) return "Medium";
  return priority.charAt(0) + priority.slice(1).toLowerCase();
};

// Helper: reshape a task from Prisma format -> frontend format
const formatTask = (task) => ({
  id: task.id,
  title: task.title,
  subject: task.category || "",
  priority: toFrontendPriority(task.priority),
  completed: task.completed,
  subtasks: task.subtasks.map((s) => ({
    id: s.id,
    title: s.title,
    done: s.completed,
  })),
});

// GET /api/tasks?page=1&limit=20
// Returns a page of tasks belonging to the logged-in user
const getTasks = async (req, res) => {
  try {
    const userId = req.user.userId; // set by requireAuth middleware

    // Pagination params — sane defaults + hard cap so a bad
    // query string (?limit=999999) can't force one huge query.
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where: { userId },
        include: { subtasks: true },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.task.count({ where: { userId } }),
    ]);

    res.status(200).json({
      results: tasks.map(formatTask),
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    console.error("getTasks error:", err);
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
};

// POST /api/tasks
// Creates a new task for the logged-in user
const createTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, subject, priority } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Task title is required" });
    }

    const task = await prisma.task.create({
      data: {
        userId,
        title: title.trim(),
        category: subject || null,
        priority: toPrismaPriority(priority),
      },
      include: { subtasks: true },
    });

    res.status(201).json(formatTask(task));
  } catch (err) {
    console.error("createTask error:", err);
    res.status(500).json({ message: "Failed to create task" });
  }
};

// PATCH /api/tasks/:id/toggle
// Flips the completed status of a task
const toggleTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ message: "Task not found" });
    }

    const task = await prisma.task.update({
      where: { id },
      data: { completed: !existing.completed },
      include: { subtasks: true },
    });

    res.status(200).json(formatTask(task));
  } catch (err) {
    console.error("toggleTask error:", err);
    res.status(500).json({ message: "Failed to update task" });
  }
};

// PATCH /api/tasks/:taskId/subtasks/:subId/toggle
// Flips the completed status of a subtask
const toggleSubtask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { taskId, subId } = req.params;

    // Make sure this task belongs to the logged-in user
    const parentTask = await prisma.task.findFirst({ where: { id: taskId, userId } });
    if (!parentTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    const existingSub = await prisma.subtask.findFirst({ where: { id: subId, taskId } });
    if (!existingSub) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    await prisma.subtask.update({
      where: { id: subId },
      data: { completed: !existingSub.completed },
    });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { subtasks: true },
    });

    res.status(200).json(formatTask(task));
  } catch (err) {
    console.error("toggleSubtask error:", err);
    res.status(500).json({ message: "Failed to update subtask" });
  }
};

// DELETE /api/tasks/:id
// Deletes a task (and its subtasks, via cascade delete)
const deleteTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ message: "Task not found" });
    }

    await prisma.task.delete({ where: { id } });

    res.status(200).json({ message: "Task deleted", id });
  } catch (err) {
    console.error("deleteTask error:", err);
    res.status(500).json({ message: "Failed to delete task" });
  }
};

module.exports = {
  getTasks,
  createTask,
  toggleTask,
  toggleSubtask,
  deleteTask,
};