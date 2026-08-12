jest.mock("../src/config/db", () => ({
  roadmapItem: {
    findMany: jest.fn(),
  },
  examAttempt: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  certificate: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/config/db");
const { CERTIFICATE_QUESTIONS } = require("../src/data/certificateQuestions");

const studentToken = jwt.sign(
  { userId: "user_1", role: "STUDENT" },
  process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod"
);
const authHeader = { Authorization: `Bearer ${studentToken}` };
const topic = Object.keys(CERTIFICATE_QUESTIONS)[0];

function incompleteMonthRoadmap() {
  return [
    {
      id: "roadmap_1",
      monthNumber: 1,
      weekNumber: 1,
      monthLabel: topic,
      title: topic,
      project: "Build a small project",
      status: "IN_PROGRESS",
    },
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.CERTIFICATE_EXAM_TEST_BYPASS;
  prisma.roadmapItem.findMany.mockResolvedValue(incompleteMonthRoadmap());
  prisma.examAttempt.findMany.mockResolvedValue([]);
  prisma.certificate.findFirst.mockResolvedValue(null);
});

describe("certificate exam roadmap gate", () => {
  it("blocks exam questions when Month 1 roadmap is incomplete", async () => {
    const res = await request(app)
      .get("/api/certificate-exam/questions")
      .set(authHeader);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Complete Month 1 roadmap/i);
  });

  it("blocks exam submission when Month 1 roadmap is incomplete", async () => {
    const res = await request(app)
      .post("/api/certificate-exam/submit")
      .set(authHeader)
      .send({ topic, answers: { 1: 0 }, startedAt: new Date().toISOString() });

    expect(res.status).toBe(403);
    expect(prisma.examAttempt.create).not.toHaveBeenCalled();
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it("allows non-production QA when the explicit test bypass is enabled", async () => {
    process.env.CERTIFICATE_EXAM_TEST_BYPASS = "true";

    const res = await request(app)
      .get("/api/certificate-exam/questions")
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.questions.length).toBeGreaterThan(0);
  });
});
