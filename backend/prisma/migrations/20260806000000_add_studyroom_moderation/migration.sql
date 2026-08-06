-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'MESSAGE_DELETED', 'DISMISSED');

-- AlterTable
ALTER TABLE "study_room_messages" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "study_room_message_reports" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_room_message_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_room_message_reports_status_idx" ON "study_room_message_reports"("status");

-- AddForeignKey
ALTER TABLE "study_room_message_reports" ADD CONSTRAINT "study_room_message_reports_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "study_room_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_room_message_reports" ADD CONSTRAINT "study_room_message_reports_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_room_message_reports" ADD CONSTRAINT "study_room_message_reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
