jest.mock("../src/config/db", () => {
  const mockPrisma = {
    course: { findUnique: jest.fn() },
    enrollment: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    payment: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    paymentRefund: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    invoice: { findUnique: jest.fn(), create: jest.fn() },
  };
  // $transaction just runs the callback against this same mocked
  // client, so `tx.payment.update` etc. hit the same jest.fn()s above.
  mockPrisma.$transaction = jest.fn((cb) => cb(mockPrisma));
  return mockPrisma;
});

const crypto = require("crypto");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const prisma = require("../src/config/db");
const {
  verifyCheckoutSignature,
  verifyWebhookSignature,
  attemptRoutePayout,
} = require("../src/controllers/payment.controller");

function authHeaderFor(role, userId = "user_1") {
  const token = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod"
  );
  return { Authorization: `Bearer ${token}` };
}

describe("payment signature verification", () => {
  it("accepts a valid Razorpay checkout signature", () => {
    const orderId = "order_test_123";
    const paymentId = "pay_test_456";
    const secret = "test_secret";
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    expect(verifyCheckoutSignature(orderId, paymentId, signature, secret)).toBe(true);
  });

  it("rejects a forged Razorpay checkout signature", () => {
    expect(verifyCheckoutSignature("order_test_123", "pay_test_456", "deadbeef", "test_secret")).toBe(false);
  });

  it("accepts a valid raw-body webhook signature", () => {
    const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const secret = "webhook_secret";
    const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    expect(verifyWebhookSignature(rawBody, signature, secret)).toBe(true);
  });
});

describe("POST /api/payments/courses/:courseId/order", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("auto-approves enrollment for a free course without calling Razorpay", async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: "course_1",
      price: 0,
      teacherId: "teacher_1",
      teacher: { name: "Mr. Rao", razorpayRouteAccountId: null },
    });
    prisma.enrollment.findUnique.mockResolvedValue(null);
    prisma.enrollment.create.mockResolvedValue({ id: "enr_1", status: "APPROVED" });

    const res = await request(app)
      .post("/api/payments/courses/course_1/order")
      .set(authHeaderFor("STUDENT"))
      .send({ contactNumber: "9999999999" });

    expect(res.status).toBe(201);
    expect(res.body.free).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("creates a Razorpay order and a PENDING payment for a paid course", async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: "course_2",
      price: 499,
      teacherId: "teacher_1",
      title: "DSA Bootcamp",
      teacher: { name: "Mr. Rao", razorpayRouteAccountId: "acc_route_1" },
    });
    prisma.enrollment.findUnique.mockResolvedValue(null);
    prisma.enrollment.create.mockResolvedValue({ id: "enr_2", status: "PENDING" });
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "order_abc", amount: 49900, currency: "INR", receipt: "rcpt" }),
    });
    prisma.payment.create.mockResolvedValue({ id: "pay_1" });

    const res = await request(app)
      .post("/api/payments/courses/course_2/order")
      .set(authHeaderFor("STUDENT"))
      .send({ contactNumber: "9999999999" });

    expect(res.status).toBe(201);
    expect(res.body.order.id).toBe("order_abc");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    // 10% default platform fee split
    const createArgs = prisma.payment.create.mock.calls[0][0].data;
    expect(createArgs.amountPaise).toBe(49900);
    expect(createArgs.platformFeePaise).toBe(4990);
    expect(createArgs.teacherAmountPaise).toBe(44910);
  });

  it("blocks a duplicate order when the student is already approved", async () => {
    prisma.course.findUnique.mockResolvedValue({ id: "course_1", price: 499, teacherId: "t1", teacher: {} });
    prisma.enrollment.findUnique.mockResolvedValue({ id: "enr_1", status: "APPROVED" });

    const res = await request(app)
      .post("/api/payments/courses/course_1/order")
      .set(authHeaderFor("STUDENT"))
      .send({});

    expect(res.status).toBe(409);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/payments/:paymentId/refund-request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lets a student request a refund on their own PAID payment", async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: "pay_1",
      studentId: "user_1",
      status: "PAID",
      amountPaise: 49900,
      refunds: [],
    });
    prisma.paymentRefund.create.mockResolvedValue({ id: "refund_1", status: "REQUESTED" });

    const res = await request(app)
      .post("/api/payments/pay_1/refund-request")
      .set(authHeaderFor("STUDENT", "user_1"))
      .send({ reason: "Changed my mind" });

    expect(res.status).toBe(201);
    expect(prisma.paymentRefund.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ paymentId: "pay_1", requestedById: "user_1" }) })
    );
  });

  it("rejects a refund request for someone else's payment", async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: "pay_1", studentId: "other_user", status: "PAID", refunds: [] });

    const res = await request(app)
      .post("/api/payments/pay_1/refund-request")
      .set(authHeaderFor("STUDENT", "user_1"))
      .send({});

    expect(res.status).toBe(404);
    expect(prisma.paymentRefund.create).not.toHaveBeenCalled();
  });

  it("rejects a refund request on a payment that isn't PAID yet", async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: "pay_1", studentId: "user_1", status: "CREATED", refunds: [] });

    const res = await request(app)
      .post("/api/payments/pay_1/refund-request")
      .set(authHeaderFor("STUDENT", "user_1"))
      .send({});

    expect(res.status).toBe(400);
  });

  it("rejects a second refund request while one is already in flight", async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: "pay_1",
      studentId: "user_1",
      status: "PAID",
      refunds: [{ status: "REQUESTED" }],
    });

    const res = await request(app)
      .post("/api/payments/pay_1/refund-request")
      .set(authHeaderFor("STUDENT", "user_1"))
      .send({});

    expect(res.status).toBe(409);
  });
});

describe("POST /api/payments/refunds/:refundId/process (admin)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("rejects a refund and never calls Razorpay", async () => {
    prisma.paymentRefund.findUnique.mockResolvedValue({
      id: "refund_1",
      status: "REQUESTED",
      payment: { razorpayPaymentId: "pay_rzp_1" },
    });
    prisma.paymentRefund.update.mockResolvedValue({ id: "refund_1", status: "REJECTED" });

    const res = await request(app)
      .post("/api/payments/refunds/refund_1/process")
      .set(authHeaderFor("ADMIN"))
      .send({ action: "reject", notes: "Outside policy window" });

    expect(res.status).toBe(200);
    expect(res.body.refund.status).toBe("REJECTED");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("approves a refund, calls Razorpay, and marks the payment REFUNDED", async () => {
    prisma.paymentRefund.findUnique.mockResolvedValue({
      id: "refund_1",
      paymentId: "pay_1",
      status: "REQUESTED",
      amountPaise: 49900,
      reason: "Not satisfied",
      payment: { razorpayPaymentId: "pay_rzp_1" },
    });
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "rfnd_abc" }) });
    prisma.paymentRefund.update.mockResolvedValue({ id: "refund_1", status: "PROCESSED", razorpayRefundId: "rfnd_abc" });
    prisma.payment.update.mockResolvedValue({ id: "pay_1", status: "REFUNDED" });

    const res = await request(app)
      .post("/api/payments/refunds/refund_1/process")
      .set(authHeaderFor("ADMIN"))
      .send({ action: "approve" });

    expect(res.status).toBe(200);
    expect(res.body.refund.status).toBe("PROCESSED");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/payments/pay_rzp_1/refund"),
      expect.objectContaining({ method: "POST" })
    );
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "pay_1" },
      data: { status: "REFUNDED" },
    });
  });

  it("returns 409 when the refund was already processed", async () => {
    prisma.paymentRefund.findUnique.mockResolvedValue({ id: "refund_1", status: "PROCESSED", payment: {} });

    const res = await request(app)
      .post("/api/payments/refunds/refund_1/process")
      .set(authHeaderFor("ADMIN"))
      .send({ action: "approve" });

    expect(res.status).toBe(409);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 404 for a refund that doesn't exist", async () => {
    prisma.paymentRefund.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/payments/refunds/does_not_exist/process")
      .set(authHeaderFor("ADMIN"))
      .send({ action: "approve" });

    expect(res.status).toBe(404);
  });

  it("blocks a non-admin from processing refunds", async () => {
    const res = await request(app)
      .post("/api/payments/refunds/refund_1/process")
      .set(authHeaderFor("STUDENT"))
      .send({ action: "approve" });

    expect(res.status).toBe(403);
    expect(prisma.paymentRefund.findUnique).not.toHaveBeenCalled();
  });
});
describe("attemptRoutePayout (Razorpay Route transfer)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("marks the payout NOT_READY and never calls Razorpay when the teacher has no linked account", async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: "pay_1",
      status: "PAID",
      payoutStatus: "ROUTE_PENDING",
      razorpayPaymentId: "rzp_pay_1",
      teacherAmountPaise: 44910,
      courseId: "course_1",
      course: { teacher: { razorpayRouteAccountId: null } },
    });

    await attemptRoutePayout("pay_1");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "pay_1" },
      data: { payoutStatus: "NOT_READY" },
    });
  });

  it("calls the Razorpay transfers API and marks the payout PAID_OUT on success", async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: "pay_2",
      status: "PAID",
      payoutStatus: "ROUTE_PENDING",
      razorpayPaymentId: "rzp_pay_2",
      teacherAmountPaise: 44910,
      courseId: "course_2",
      course: { teacher: { razorpayRouteAccountId: "acc_route_1" } },
    });
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: "trf_abc" }] }),
    });

    await attemptRoutePayout("pay_2");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/payments/rzp_pay_2/transfers"),
      expect.objectContaining({ method: "POST" })
    );
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "pay_2" },
      data: { payoutStatus: "PAID_OUT", payoutReference: "trf_abc" },
    });
  });

  it("marks the payout FAILED when the Razorpay transfer call errors, without throwing", async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: "pay_3",
      status: "PAID",
      payoutStatus: "ROUTE_PENDING",
      razorpayPaymentId: "rzp_pay_3",
      teacherAmountPaise: 44910,
      courseId: "course_3",
      course: { teacher: { razorpayRouteAccountId: "acc_route_1" } },
    });
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { description: "Linked account not active" } }),
    });

    await expect(attemptRoutePayout("pay_3")).resolves.not.toThrow();

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "pay_3" },
      data: { payoutStatus: "FAILED" },
    });
  });

  it("never double-transfers a payment that's already PAID_OUT", async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: "pay_4",
      status: "PAID",
      payoutStatus: "PAID_OUT",
      razorpayPaymentId: "rzp_pay_4",
      course: { teacher: { razorpayRouteAccountId: "acc_route_1" } },
    });

    await attemptRoutePayout("pay_4");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/payments/:paymentId/retry-payout", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("blocks a non-admin from retrying a payout", async () => {
    const res = await request(app)
      .post("/api/admin/payments/pay_1/retry-payout")
      .set(authHeaderFor("TEACHER"));

    expect(res.status).toBe(403);
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  it("refuses to retry a payout for a payment that isn't PAID yet", async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: "pay_1", status: "CREATED", payoutStatus: "NOT_READY" });

    const res = await request(app)
      .post("/api/admin/payments/pay_1/retry-payout")
      .set(authHeaderFor("ADMIN"));

    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses to retry a payout that's already PAID_OUT", async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: "pay_1", status: "PAID", payoutStatus: "PAID_OUT" });

    const res = await request(app)
      .post("/api/admin/payments/pay_1/retry-payout")
      .set(authHeaderFor("ADMIN"));

    expect(res.status).toBe(409);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
