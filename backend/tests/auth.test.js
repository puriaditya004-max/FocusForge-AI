// ---------------------------------------------------------
// tests/auth.test.js
// Covers the most critical endpoints in the app: signup and
// login. If auth breaks, nothing else in the app matters, so
// this is the first thing tested.
//
// The real database is NOT touched — prisma.user.* is mocked
// so these tests run fast and don't need a live Neon connection.
// This mock must point at the exact same file the controller
// requires ("../src/config/db"), or Jest will mock a different
// copy of the module and the controller will still hit the
// real (unmocked) client.
// ---------------------------------------------------------
jest.mock("../src/config/db", () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}));

const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const prisma = require("../src/config/db");

// A fresh, valid password that satisfies the zod policy:
// 8+ chars, at least one letter, one number, one special char.
const VALID_PASSWORD = "Str0ng!Pass";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/auth/signup", () => {
  it("creates a new user and returns it without the password hash", async () => {
    prisma.user.findUnique.mockResolvedValue(null); // no existing user with this email
    prisma.user.create.mockResolvedValue({
      id: "user_1",
      name: "Aditya",
      email: "aditya@example.com",
      role: "STUDENT",
      passwordHash: "should-never-appear-in-response",
    });

    const res = await request(app).post("/api/auth/signup").send({
      name: "Aditya",
      email: "aditya@example.com",
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("aditya@example.com");
    expect(res.body.user.passwordHash).toBeUndefined(); // must never leak the hash
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a weak password before it ever reaches the database", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "Aditya",
      email: "weakpass@example.com",
      password: "12345", // too short, no letter, no special char
    });

    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled(); // validation blocked it early
  });

  it("returns a generic conflict message if the email is already registered", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "existing_user" });

    const res = await request(app).post("/api/auth/signup").send({
      name: "Aditya",
      email: "duplicate@example.com",
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(409);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  it("logs in successfully with the correct password", async () => {
    const passwordHash = await bcrypt.hash(VALID_PASSWORD, 12);
    prisma.user.findUnique.mockResolvedValue({
      id: "user_2",
      name: "Aditya",
      email: "login@example.com",
      role: "STUDENT",
      passwordHash,
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "login@example.com",
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("login@example.com");
    expect(res.headers["set-cookie"]).toBeDefined(); // auth cookie should be set
  });

  it("rejects an incorrect password with a generic message", async () => {
    const passwordHash = await bcrypt.hash(VALID_PASSWORD, 12);
    prisma.user.findUnique.mockResolvedValue({
      id: "user_3",
      email: "wrongpass@example.com",
      passwordHash,
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "wrongpass@example.com",
      password: "TotallyWrong1!",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it("does not reveal whether the email exists when the user is not found", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/login").send({
      email: "doesnotexist@example.com",
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });
});

describe("GET /api/auth/me", () => {
  it("rejects the request when there is no auth cookie or token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});