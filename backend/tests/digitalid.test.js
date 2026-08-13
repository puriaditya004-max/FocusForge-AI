// ---------------------------------------------------------
// tests/digitalid.test.js
// Confirms Digital ID cards only issue to identity-verified
// users, auto-generate on first request, and that the public
// verify endpoint never leaks PII or validates a revoked card.
// ---------------------------------------------------------
jest.mock("../src/config/db", () => ({
  user: {
    findUnique: jest.fn(),
  },
  digitalId: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/config/db");

const authToken = jwt.sign(
  { userId: "user_1", role: "STUDENT" },
  process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod"
);
const authHeader = { Authorization: `Bearer ${authToken}` };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/digital-id/me", () => {
  it("blocks the request entirely when there is no auth token", async () => {
    const res = await request(app).get("/api/digital-id/me");
    expect(res.status).toBe(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("refuses to issue a card when identity is not verified", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      role: "STUDENT",
      name: "Test Student",
      emailVerifiedAt: null,
      mobileVerifiedAt: null,
    });

    const res = await request(app).get("/api/digital-id/me").set(authHeader);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("IDENTITY_NOT_VERIFIED");
    expect(prisma.digitalId.create).not.toHaveBeenCalled();
  });

  it("auto-generates a card on first request once identity is verified", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      role: "STUDENT",
      name: "Test Student",
      avatarUrl: null,
      dateOfBirth: null,
      emailVerifiedAt: new Date(),
      mobileVerifiedAt: null,
      onboardingCompletedAt: new Date(),
    });
    prisma.digitalId.findUnique.mockResolvedValue(null);
    prisma.digitalId.create.mockResolvedValue({
      cardNumber: "FF-STU-ABC12345",
      verifyToken: "tok_abc",
      status: "ACTIVE",
      issuedAt: new Date(),
      revokedAt: null,
    });

    const res = await request(app).get("/api/digital-id/me").set(authHeader);

    expect(res.status).toBe(200);
    expect(prisma.digitalId.create).toHaveBeenCalledTimes(1);
    expect(res.body.card.cardNumber).toMatch(/^FF-STU-/);
  });

  it("returns the existing card without creating a new one on repeat requests", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      role: "STUDENT",
      name: "Test Student",
      avatarUrl: null,
      dateOfBirth: null,
      emailVerifiedAt: new Date(),
      mobileVerifiedAt: null,
      onboardingCompletedAt: new Date(),
    });
    prisma.digitalId.findUnique.mockResolvedValue({
      cardNumber: "FF-STU-EXISTING1",
      verifyToken: "tok_existing",
      status: "ACTIVE",
      issuedAt: new Date(),
      revokedAt: null,
    });

    const res = await request(app).get("/api/digital-id/me").set(authHeader);

    expect(res.status).toBe(200);
    expect(prisma.digitalId.create).not.toHaveBeenCalled();
    expect(res.body.card.cardNumber).toBe("FF-STU-EXISTING1");
  });

  it("requires student onboarding before issuing a card", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      role: "STUDENT",
      name: "Test Student",
      emailVerifiedAt: new Date(),
      mobileVerifiedAt: null,
      onboardingCompletedAt: null,
    });

    const res = await request(app).get("/api/digital-id/me").set(authHeader);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ONBOARDING_REQUIRED");
    expect(prisma.digitalId.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/digital-id/verify/:token", () => {
  it("returns valid:false for an unknown token without a 500", async () => {
    prisma.digitalId.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/digital-id/verify/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.valid).toBe(false);
  });

  it("returns valid:false for a revoked card", async () => {
    prisma.digitalId.findUnique.mockResolvedValue({
      cardNumber: "FF-STU-REVOKED1",
      status: "REVOKED",
      issuedAt: new Date(),
      user: { name: "Test Student", role: "STUDENT" },
    });

    const res = await request(app).get("/api/digital-id/verify/tok_revoked");

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it("confirms a valid, active card and does not leak email/DOB", async () => {
    prisma.digitalId.findUnique.mockResolvedValue({
      cardNumber: "FF-STU-ACTIVE1",
      status: "ACTIVE",
      issuedAt: new Date(),
      user: { name: "Test Student", role: "STUDENT" },
    });

    const res = await request(app).get("/api/digital-id/verify/tok_active");

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body).not.toHaveProperty("email");
    expect(res.body).not.toHaveProperty("dateOfBirth");
  });
});
