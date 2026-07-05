// ---------------------------------------------------------
// controllers/marketplace.controller.js
// Classes Marketplace — with a real approval flow.
//
// Enrolling no longer instantly counts as a student. It
// creates a PENDING request (with the student's contact
// number). Only after the teacher APPROVES it (after
// confirming payment themselves) does it count toward real
// student/earnings numbers.
// ---------------------------------------------------------

const prisma = require("../config/db");

// GET /api/marketplace/courses
async function browseCourses(req, res) {
  try {
    const studentId = req.user.userId;

    const courses = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        teacher: { select: { id: true, name: true } },
        enrollments: { select: { studentId: true, status: true } },
      },
    });

    const results = courses.map((c) => {
      const myEnrollment = c.enrollments.find((e) => e.studentId === studentId);
      const approvedCount = c.enrollments.filter((e) => e.status === "APPROVED").length;

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        price: c.price,
        teacherName: c.teacher.name,
        studentsEnrolled: approvedCount, // only real, paid/approved students count
        enrollmentStatus: myEnrollment ? myEnrollment.status : null, // null | PENDING | APPROVED | REJECTED
        createdAt: c.createdAt,
      };
    });

    return res.json({ courses: results });
  } catch (err) {
    console.error("Marketplace browseCourses error:", err);
    return res.status(500).json({ error: "Failed to load courses." });
  }
}

// POST /api/marketplace/courses/:courseId/enroll
// Body: { name, contactNumber }
// Creates a PENDING request — NOT an instant enrollment.
async function enrollInCourse(req, res) {
  try {
    const studentId = req.user.userId;
    const { courseId } = req.params;
    const { contactNumber } = req.body;

    if (!contactNumber || !contactNumber.trim()) {
      return res.status(400).json({ error: "Contact number is required so the teacher can confirm payment." });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return res.status(404).json({ error: "Course not found." });
    }

    const existing = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });

    if (existing) {
      if (existing.status === "PENDING") {
        return res.status(409).json({ error: "You already have a pending request for this course." });
      }
      if (existing.status === "APPROVED") {
        return res.status(409).json({ error: "You're already enrolled in this course." });
      }
      // status was REJECTED — allow requesting again
      const updated = await prisma.enrollment.update({
        where: { id: existing.id },
        data: { status: "PENDING", contactNumber: contactNumber.trim(), respondedAt: null },
      });
      return res.status(201).json({ message: "Enrollment request re-submitted.", enrollment: updated });
    }

    const enrollment = await prisma.enrollment.create({
      data: { studentId, courseId, contactNumber: contactNumber.trim(), status: "PENDING" },
    });

    return res.status(201).json({
      message: `Request sent for "${course.title}". The teacher will confirm once payment is verified.`,
      enrollment,
    });
  } catch (err) {
    console.error("Marketplace enrollInCourse error:", err);
    return res.status(500).json({ error: "Failed to submit enrollment request." });
  }
}

// GET /api/marketplace/my-courses
// Shows ALL of the student's requests, whatever status they're in,
// so a student can see "Pending" ones too, not just approved ones.
async function getMyCourses(req, res) {
  try {
    const studentId = req.user.userId;

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId },
      include: { course: { include: { teacher: { select: { name: true } } } } },
      orderBy: { enrolledAt: "desc" },
    });

    const results = enrollments.map((e) => ({
      enrollmentId: e.id,
      courseId: e.course.id,
      title: e.course.title,
      teacherName: e.course.teacher.name,
      progress: e.progress,
      status: e.status,
      enrolledAt: e.enrolledAt,
    }));

    return res.json({ courses: results });
  } catch (err) {
    console.error("Marketplace getMyCourses error:", err);
    return res.status(500).json({ error: "Failed to load your courses." });
  }
}

module.exports = { browseCourses, enrollInCourse, getMyCourses };