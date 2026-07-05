// ---------------------------------------------------------
// controllers/teacher.controller.js
// Teacher Dashboard — 100% real data, with an enrollment
// approval flow. Only APPROVED enrollments count toward
// real student totals and real earnings — pending requests
// don't inflate the numbers until the teacher confirms
// payment and approves them.
// ---------------------------------------------------------

const prisma = require("../config/db");

// GET /api/teacher/overview
async function getOverview(req, res) {
  try {
    const teacherId = req.user.userId;

    const courses = await prisma.course.findMany({
      where: { teacherId },
      include: { enrollments: true },
      orderBy: { createdAt: "desc" },
    });

    let totalEarnings = 0;
    const uniqueApprovedStudentIds = new Set();
    let pendingRequestCount = 0;

    const courseSummaries = courses.map((c) => {
      const approved = c.enrollments.filter((e) => e.status === "APPROVED");
      const pending = c.enrollments.filter((e) => e.status === "PENDING");

      approved.forEach((e) => uniqueApprovedStudentIds.add(e.studentId));
      pendingRequestCount += pending.length;
      totalEarnings += c.price * approved.length;

      return {
        id: c.id,
        title: c.title,
        price: c.price,
        studentsEnrolled: approved.length,
        pendingRequests: pending.length,
        earnings: c.price * approved.length,
        createdAt: c.createdAt,
      };
    });

    return res.json({
      totalCourses: courses.length,
      totalStudents: uniqueApprovedStudentIds.size,
      totalEarnings,
      pendingRequestCount,
      courses: courseSummaries,
    });
  } catch (err) {
    console.error("Teacher getOverview error:", err);
    return res.status(500).json({ error: "Failed to load teacher overview." });
  }
}

// POST /api/teacher/courses
async function createCourse(req, res) {
  try {
    const teacherId = req.user.userId;
    const { title, description, price } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Course title is required." });
    }

    const course = await prisma.course.create({
      data: {
        teacherId,
        title: title.trim(),
        description: description?.trim() || null,
        price: Number(price) || 0,
      },
    });

    return res.status(201).json({ course });
  } catch (err) {
    console.error("Teacher createCourse error:", err);
    return res.status(500).json({ error: "Failed to create course." });
  }
}

// GET /api/teacher/enrollment-requests
// Every PENDING request across all of this teacher's courses,
// with the student's name, email, and the contact number they
// submitted — so the teacher can reach out and confirm payment.
async function getEnrollmentRequests(req, res) {
  try {
    const teacherId = req.user.userId;

    const requests = await prisma.enrollment.findMany({
      where: {
        status: "PENDING",
        course: { teacherId },
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true, price: true } },
      },
      orderBy: { enrolledAt: "asc" }, // oldest request first
    });

    const results = requests.map((r) => ({
      enrollmentId: r.id,
      studentName: r.student.name,
      studentEmail: r.student.email,
      contactNumber: r.contactNumber,
      courseTitle: r.course.title,
      coursePrice: r.course.price,
      requestedAt: r.enrolledAt,
    }));

    return res.json({ requests: results });
  } catch (err) {
    console.error("Teacher getEnrollmentRequests error:", err);
    return res.status(500).json({ error: "Failed to load enrollment requests." });
  }
}

// POST /api/teacher/enrollment-requests/:enrollmentId/respond
// Body: { action: "approve" | "reject" }
async function respondToRequest(req, res) {
  try {
    const teacherId = req.user.userId;
    const { enrollmentId } = req.params;
    const { action } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Action must be 'approve' or 'reject'." });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true },
    });

    if (!enrollment || enrollment.course.teacherId !== teacherId) {
      return res.status(404).json({ error: "Enrollment request not found." });
    }

    const updated = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        respondedAt: new Date(),
      },
    });

    return res.json({ message: `Request ${action === "approve" ? "approved" : "rejected"}.`, enrollment: updated });
  } catch (err) {
    console.error("Teacher respondToRequest error:", err);
    return res.status(500).json({ error: "Failed to respond to enrollment request." });
  }
}

module.exports = { getOverview, createCourse, getEnrollmentRequests, respondToRequest };