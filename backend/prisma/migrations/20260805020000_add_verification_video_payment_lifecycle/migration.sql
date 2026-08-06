-- Extend roles for internal review/admin tooling.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';

-- Verification and lifecycle enums.
CREATE TYPE "OtpChannel" AS ENUM ('EMAIL', 'MOBILE');
CREATE TYPE "TeacherVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "PayoutStatus" AS ENUM ('NOT_READY', 'ROUTE_PENDING', 'ROUTE_LINKED', 'PAID_OUT', 'FAILED');
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'PROCESSED', 'FAILED', 'REJECTED');

-- User verification and teacher payout metadata.
ALTER TABLE "users"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "mobileNumber" TEXT,
  ADD COLUMN "mobileVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "teacherVerificationStatus" "TeacherVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  ADD COLUMN "teacherVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "razorpayRouteAccountId" TEXT;

-- Courses can be unpublished while a teacher waits for verification.
ALTER TABLE "courses" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true;

-- OTP challenges.
CREATE TABLE "otp_challenges" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "channel" "OtpChannel" NOT NULL,
  "target" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'VERIFY_ACCOUNT',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "otp_challenges_target_channel_purpose_idx" ON "otp_challenges"("target", "channel", "purpose");
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Teacher verification documents and review state.
CREATE TABLE "teacher_verifications" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "status" "TeacherVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "fullName" TEXT NOT NULL,
  "institute" TEXT,
  "qualification" TEXT,
  "experienceYears" INTEGER,
  "idDocumentUrl" TEXT NOT NULL,
  "educationDocumentUrl" TEXT,
  "notes" TEXT,
  "reviewerNotes" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "teacher_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teacher_verifications_teacherId_key" ON "teacher_verifications"("teacherId");
ALTER TABLE "teacher_verifications" ADD CONSTRAINT "teacher_verifications_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Course videos.
CREATE TABLE "course_videos" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "videoUrl" TEXT NOT NULL,
  "storageKey" TEXT,
  "durationSec" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPreview" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "course_videos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "course_videos_courseId_sortOrder_idx" ON "course_videos"("courseId", "sortOrder");
ALTER TABLE "course_videos" ADD CONSTRAINT "course_videos_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payment lifecycle metadata.
ALTER TABLE "payments"
  ADD COLUMN "platformFeePaise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "teacherAmountPaise" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'NOT_READY',
  ADD COLUMN "payoutReference" TEXT;

CREATE TABLE "payment_refunds" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "reason" TEXT,
  "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "razorpayRefundId" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_refunds_razorpayRefundId_key" ON "payment_refunds"("razorpayRefundId");
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "studentName" TEXT NOT NULL,
  "studentEmail" TEXT NOT NULL,
  "teacherName" TEXT NOT NULL,
  "courseTitle" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "platformFeePaise" INTEGER NOT NULL,
  "teacherAmountPaise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoices_paymentId_key" ON "invoices"("paymentId");
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
