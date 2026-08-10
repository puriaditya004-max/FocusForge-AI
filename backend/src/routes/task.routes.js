// ---------------------------------------------------------
// task.routes.js — API endpoints for Today's Plan tasks
// ---------------------------------------------------------
const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { requirePremiumAccess } = require("../middleware/subscription.middleware");
const validate = require("../middleware/validate.middleware");
const { createTaskSchema, updateTaskSchema } = require("../validators/task.validator");
const {
  getTasks,
  createTask,
  toggleTask,
  toggleSubtask,
  deleteTask,
  updateTask,
} = require("../controllers/task.controller");

const router = express.Router();

// All task routes require the user to be logged in
router.use(requireAuth);

router.get("/", getTasks);
router.post("/", requirePremiumAccess, validate(createTaskSchema), createTask);
router.patch("/:id/toggle", requirePremiumAccess, toggleTask);
router.patch("/:taskId/subtasks/:subId/toggle", requirePremiumAccess, toggleSubtask);
router.patch("/:id", requirePremiumAccess, validate(updateTaskSchema), updateTask);
router.delete("/:id", requirePremiumAccess, deleteTask);

module.exports = router;
