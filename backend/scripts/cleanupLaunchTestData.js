const prisma = require("../src/config/db");

const CONFIRM_VALUE = "DELETE_TEST_DATA";
const keepEmails = new Set(
  String(process.env.KEEP_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const isConfirmed = process.env.CONFIRM_CLEAN_LAUNCH_DATA === CONFIRM_VALUE;

async function countModel(model, where) {
  return prisma[model].count(where ? { where } : undefined);
}

async function deleteModel(model, where) {
  return prisma[model].deleteMany(where ? { where } : undefined);
}

async function main() {
  const usersToDelete = await prisma.user.findMany({
    where: {
      role: { not: "ADMIN" },
      email: keepEmails.size ? { notIn: [...keepEmails] } : undefined,
    },
    select: { id: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  });

  const userIds = usersToDelete.map((user) => user.id);
  const userWhere = { userId: { in: userIds } };

  const counts = {
    users: usersToDelete.length,
    studyRoomMessageReports: await countModel("studyRoomMessageReport"),
    paymentRefunds: await countModel("paymentRefund"),
    invoices: await countModel("invoice"),
    payments: await countModel("payment"),
    subscriptionPayments: await countModel("subscriptionPayment", userWhere),
    subscriptions: await countModel("subscription", userWhere),
    enrollments: await countModel("enrollment"),
    courseVideos: await countModel("courseVideo"),
    courses: await countModel("course"),
    parentLinks: await countModel("studentParentLink"),
    roomMembers: await countModel("roomMember", userWhere),
    studyRoomMessages: await countModel("studyRoomMessage", userWhere),
    rooms: await countModel("room"),
    tasks: await countModel("task", userWhere),
    roadmapItems: await countModel("roadmapItem", userWhere),
    focusSessions: await countModel("focusSession", userWhere),
    userBadges: await countModel("userBadge", userWhere),
    dailyChallenges: await countModel("dailyChallenge", userWhere),
    certificateExamBanks: await countModel("certificateExamBank", userWhere),
    certificates: await countModel("certificate", userWhere),
    examAttempts: await countModel("examAttempt", userWhere),
    penaltyEvents: await countModel("penaltyEvent", userWhere),
    activityLogs: await countModel("activityLog", userWhere),
    aiMentorMessages: await countModel("aiMentorMessage", userWhere),
    savedVideos: await countModel("savedVideo", userWhere),
    quizAttempts: await countModel("quizAttempt", userWhere),
    otpChallenges: await countModel("otpChallenge", userWhere),
    teacherVerifications: await countModel("teacherVerification", { teacherId: { in: userIds } }),
    digitalIds: await countModel("digitalId", userWhere),
    paymentWebhookEvents: await countModel("paymentWebhookEvent"),
  };

  console.log("Launch cleanup target: all non-admin users and their test data.");
  console.log(`Users to delete: ${usersToDelete.length}`);
  if (keepEmails.size) {
    console.log(`Keeping emails: ${[...keepEmails].join(", ")}`);
  }
  console.table(counts);

  if (!isConfirmed) {
    console.log("");
    console.log("DRY RUN ONLY. No data was deleted.");
    console.log(`To actually delete, run with CONFIRM_CLEAN_LAUNCH_DATA=${CONFIRM_VALUE}`);
    return;
  }

  if (!userIds.length) {
    console.log("No non-admin users found. Nothing to delete.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.studyRoomMessageReport.deleteMany({});
      await tx.paymentRefund.deleteMany({});
      await tx.invoice.deleteMany({});
      await tx.paymentWebhookEvent.deleteMany({});
      await tx.subscriptionPayment.deleteMany(userWhere);
      await tx.payment.deleteMany({});
      await tx.enrollment.deleteMany({});
      await tx.courseVideo.deleteMany({});
      await tx.course.deleteMany({});
      await tx.studentParentLink.deleteMany({});
      await tx.roomMember.deleteMany(userWhere);
      await tx.studyRoomMessage.deleteMany(userWhere);
      await tx.room.deleteMany({});
      await tx.subtask.deleteMany({ where: { task: userWhere } });
      await tx.task.deleteMany(userWhere);
      await tx.roadmapItem.deleteMany(userWhere);
      await tx.focusSession.deleteMany(userWhere);
      await tx.userBadge.deleteMany(userWhere);
      await tx.dailyChallenge.deleteMany(userWhere);
      await tx.certificateExamBank.deleteMany(userWhere);
      await tx.certificate.deleteMany(userWhere);
      await tx.examAttempt.deleteMany(userWhere);
      await tx.penaltyEvent.deleteMany(userWhere);
      await tx.activityLog.deleteMany(userWhere);
      await tx.aiMentorMessage.deleteMany(userWhere);
      await tx.savedVideo.deleteMany(userWhere);
      await tx.quizAttempt.deleteMany(userWhere);
      await tx.otpChallenge.deleteMany(userWhere);
      await tx.teacherVerification.deleteMany({ where: { teacherId: { in: userIds } } });
      await tx.digitalId.deleteMany(userWhere);
      await tx.subscription.deleteMany(userWhere);
      await tx.user.deleteMany({
        where: {
          id: { in: userIds },
          role: { not: "ADMIN" },
        },
      });
    },
    { timeout: 30000 }
  );

  console.log("Cleanup complete. Non-admin test accounts and related data were deleted.");
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
