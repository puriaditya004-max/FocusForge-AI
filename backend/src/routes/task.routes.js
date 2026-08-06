// ---------------------------------------------------------
// task.routes.js — API endpoints for Today's Plan tasks
// ---------------------------------------------------------
const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { createTaskSchema } = require("../validators/task.validator");
const {
  getTasks,
  createTask,
  toggleTask,
  toggleSubtask,
  deleteTask,
} = require("../controllers/task.controller");

const router = express.Router();

// All task routes require the user to be logged in
router.use(requireAuth);

router.get("/", getTasks);
router.post("/", validate(createTaskSchema), createTask);
router.patch("/:id/toggle", toggleTask);
router.patch("/:taskId/subtasks/:subId/toggle", toggleSubtask);
router.delete("/:id", deleteTask);

module.exports = router;