// ---------------------------------------------------------
// tests/task.test.js
// Confirms the validation layer added on top of Task routes
// actually blocks bad input — not just that the middleware
// files exist, but that they're wired and working.
// ---------------------------------------------------------
jest.mock("../src/config/db", () => ({
  task: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/config/db");

// requireAuth accepts a Bearer token — sign one with the same
// secret the test script sets (see package.json "test" script).
const authToken = jwt.sign(
  { userId: "user_1", role: "STUDENT" },
  process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod"
);
const authHeader = { Authorization: `Bearer ${authToken}` };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/tasks", () => {
  it("rejects a task with no title before it reaches the database", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set(authHeader)
      .send({ subject: "Physics", priority: "High" }); // title missing

    expect(res.status).toBe(400);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it("rejects a title that is only whitespace", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set(authHeader)
      .send({ title: "   " });

    expect(res.status).toBe(400);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid priority value", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set(authHeader)
      .send({ title: "Physics revision", priority: "Urgent" }); // not a valid enum value

    expect(res.status).toBe(400);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it("creates a task when the payload is valid", async () => {
    prisma.task.create.mockResolvedValue({
      id: "task_1",
      title: "Physics revision",
      category: "Physics",
      priority: "HIGH",
      completed: false,
      subtasks: [],
    });

    const res = await request(app)
      .post("/api/tasks")
      .set(authHeader)
      .send({ title: "Physics revision", subject: "Physics", priority: "High" });

    expect(res.status).toBe(201);
    expect(prisma.task.create).toHaveBeenCalledTimes(1);
  });

  it("blocks the request entirely when there is no auth token", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ title: "No auth task" });

    expect(res.status).toBe(401);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/tasks", () => {
  it("returns a paginated list for the logged-in user", async () => {
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);

    const res = await request(app).get("/api/tasks?page=1&limit=20").set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("page", 1);
    expect(res.body).toHaveProperty("totalPages");
  });
});