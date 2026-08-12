jest.mock("../src/config/db", () => ({
  roadmapItem: {
    findMany: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
  },
  certificateExamBank: {
    findFirst: jest.fn(),
    create: jest.fn(),
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

const studentToken = jwt.sign(
  { userId: "user_1", role: "STUDENT" },
  process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod"
);
const authHeader = { Authorization: `Bearer ${studentToken}` };
const topic = "NEET Biology - Month 1";

function incompleteMonthRoadmap() {
  return [
    {
      id: "roadmap_1",
      monthNumber: 1,
      weekNumber: 1,
      monthLabel: "NEET Biology Month 1",
      title: "Cell Structure and Genetics",
      project: "Solve NCERT cell biology practice set",
      status: "IN_PROGRESS",
    },
  ];
}

function storedQuestions() {
  return Array.from({ length: 20 }, (_, idx) => ({
    id: idx + 1,
    type: idx > 15 ? "project" : "theory",
    q: `Biology question ${idx + 1}?`,
    options: ["A", "B", "C", "D"],
    answer: 0,
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.CERTIFICATE_EXAM_TEST_BYPASS;
  prisma.roadmapItem.findMany.mockResolvedValue(incompleteMonthRoadmap());
  prisma.task.findMany.mockResolvedValue([]);
  prisma.examAttempt.findMany.mockResolvedValue([]);
  prisma.certificate.findFirst.mockResolvedValue(null);
  prisma.certificateExamBank.findFirst.mockResolvedValue({
    id: "bank_1",
    userId: "user_1",
    topic,
    syllabusHash: "hash_1",
    questions: storedQuestions(),
  });
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
    expect(res.body.topic).toBe(topic);
    expect(res.body.questions).toHaveLength(20);
    expect(res.body.questions[0].answer).toBeUndefined();
  });
});
