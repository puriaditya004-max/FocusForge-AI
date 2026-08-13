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
    update: jest.fn(),
  },
  digitalId: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  otpChallenge: {
    updateMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((operations) => Promise.all(operations)),
}));

jest.mock("../src/utils/otp", () => ({
  OTP_TTL_MS: 10 * 60 * 1000,
  generateOtp: jest.fn(() => "123456"),
  hashOtp: jest.fn((code) => `hash:${code}`),
  verifyOtpHash: jest.fn((code, hash) => hash === `hash:${code}`),
  deliverOtp: jest.fn().mockResolvedValue(undefined),
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
  it("creates an unverified user and sends an email OTP without setting a session", async () => {
    prisma.user.findUnique.mockResolvedValue(null); // no existing user with this email
    prisma.user.create.mockResolvedValue({
      id: "user_1",
      name: "Aditya",
      email: "aditya@example.com",
      role: "STUDENT",
      emailVerifiedAt: null,
      passwordHash: "should-never-appear-in-response",
    });
    prisma.otpChallenge.updateMany.mockResolvedValue({ count: 0 });
    prisma.otpChallenge.create.mockResolvedValue({ id: "otp_1" });

    const res = await request(app).post("/api/auth/signup").send({
      name: "Aditya",
      email: "aditya@example.com",
    });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe("EMAIL_VERIFICATION_SENT");
    expect(res.body.verificationToken).toBeDefined();
    expect(res.body.user.email).toBe("aditya@example.com");
    expect(res.body.user.passwordHash).toBeUndefined(); // must never leak the hash
    expect(res.headers["set-cookie"]).toBeUndefined(); // no session until email is verified
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.otpChallenge.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a weak password before it ever reaches the database", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "Aditya",
      email: "weakpass@example.com",
      password: "12345", // ignored by the new email-first signup contract
    });

    expect(res.status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed signup email before it reaches the database", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "Aditya",
      email: "not-an-email",
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
  it("logs in successfully with the correct Digital ID and password", async () => {
    const passwordHash = await bcrypt.hash(VALID_PASSWORD, 12);
    prisma.digitalId.findUnique.mockResolvedValue({
      cardNumber: "FF-STU-LOGIN123",
      user: {
        id: "user_2",
        name: "Aditya",
        email: "login@example.com",
        role: "STUDENT",
        emailVerifiedAt: new Date(),
        onboardingCompletedAt: new Date(),
        passwordHash,
      },
    });

    const res = await request(app).post("/api/auth/login").send({
      identifier: "FF-STU-LOGIN123",
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("login@example.com");
    expect(res.headers["set-cookie"]).toBeDefined(); // auth cookie should be set
  });

  it("requires email verification before creating a session", async () => {
    const passwordHash = await bcrypt.hash(VALID_PASSWORD, 12);
    prisma.digitalId.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: "user_unverified",
      name: "Aditya",
      email: "verify@example.com",
      role: "STUDENT",
      emailVerifiedAt: null,
      onboardingCompletedAt: null,
      passwordHash,
    });
    prisma.otpChallenge.updateMany.mockResolvedValue({ count: 0 });
    prisma.otpChallenge.create.mockResolvedValue({ id: "otp_login" });

    const res = await request(app).post("/api/auth/login").send({
      identifier: "verify@example.com",
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("EMAIL_VERIFICATION_REQUIRED");
    expect(res.body.verificationToken).toBeDefined();
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects an incorrect password with a generic message", async () => {
    const passwordHash = await bcrypt.hash(VALID_PASSWORD, 12);
    prisma.digitalId.findUnique.mockResolvedValue({
      cardNumber: "FF-STU-WRONG123",
      user: {
        id: "user_3",
        email: "wrongpass@example.com",
        role: "STUDENT",
        emailVerifiedAt: new Date(),
        onboardingCompletedAt: new Date(),
        passwordHash,
      },
    });

    const res = await request(app).post("/api/auth/login").send({
      identifier: "FF-STU-WRONG123",
      password: "TotallyWrong1!",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid digital id or password/i);
  });

  it("does not reveal whether the email exists when the user is not found", async () => {
    prisma.digitalId.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/login").send({
      identifier: "FF-STU-NOTREAL",
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid digital id or password/i);
  });
});

describe("POST /api/auth/onboarding/complete", () => {
  it("sets student profile, password, and issues a Digital ID", async () => {
    const jwt = require("jsonwebtoken");
    const token = jwt.sign({ userId: "student_1", role: "STUDENT" }, process.env.JWT_SECRET, { expiresIn: "7d" });

    prisma.user.findUnique.mockResolvedValue({
      id: "student_1",
      name: "Aditya",
      email: "aditya@example.com",
      role: "STUDENT",
      emailVerifiedAt: new Date(),
      onboardingCompletedAt: null,
      passwordHash: "old-hash",
      digitalId: null,
    });
    prisma.user.update.mockResolvedValue({
      id: "student_1",
      name: "Aditya",
      email: "aditya@example.com",
      role: "STUDENT",
      emailVerifiedAt: new Date(),
      onboardingCompletedAt: new Date(),
      passwordHash: "new-hash",
      preparationTrack: "JEE",
      digitalId: null,
    });
    prisma.digitalId.findUnique.mockResolvedValue(null);
    prisma.digitalId.create.mockResolvedValue({
      id: "card_1",
      cardNumber: "FF-STU-ABC12345",
      verifyToken: "verify_token",
      status: "ACTIVE",
    });

    const res = await request(app)
      .post("/api/auth/onboarding/complete")
      .set("Cookie", [`token=${token}`])
      .send({
        preparationTrack: "JEE",
        dateOfBirth: "2005-01-01",
        password: VALID_PASSWORD,
      });

    expect(res.status).toBe(200);
    expect(res.body.digitalId.cardNumber).toBe("FF-STU-ABC12345");
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.digitalId.create).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/auth/me", () => {
  it("rejects the request when there is no auth cookie or token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/email/verify", () => {
  it("verifies a valid email OTP and then sets the auth cookie", async () => {
    const jwt = require("jsonwebtoken");
    const verificationToken = jwt.sign(
      {
        userId: "user_verify",
        email: "verify@example.com",
        purpose: "VERIFY_ACCOUNT",
        type: "email_verification",
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    prisma.user.findUnique.mockResolvedValue({
      id: "user_verify",
      name: "Aditya",
      email: "verify@example.com",
      role: "STUDENT",
      emailVerifiedAt: null,
      passwordHash: "hidden",
    });
    prisma.otpChallenge.findFirst.mockResolvedValue({
      id: "otp_verify",
      attempts: 0,
      maxAttempts: 5,
      codeHash: "hash:123456",
    });
    prisma.user.update.mockResolvedValue({
      id: "user_verify",
      name: "Aditya",
      email: "verify@example.com",
      role: "STUDENT",
      emailVerifiedAt: new Date(),
      passwordHash: "hidden",
    });
    prisma.otpChallenge.update.mockResolvedValue({ id: "otp_verify" });

    const res = await request(app).post("/api/auth/email/verify").send({
      verificationToken,
      code: "123456",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.emailVerifiedAt).toBeDefined();
    expect(res.headers["set-cookie"]).toBeDefined();
  });
});
