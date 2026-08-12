CREATE TABLE "certificate_exam_banks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "syllabusHash" TEXT NOT NULL,
    "syllabus" JSONB NOT NULL,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_exam_banks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "certificate_exam_banks_userId_topic_syllabusHash_key"
ON "certificate_exam_banks"("userId", "topic", "syllabusHash");

CREATE INDEX "certificate_exam_banks_userId_topic_idx"
ON "certificate_exam_banks"("userId", "topic");

ALTER TABLE "certificate_exam_banks"
ADD CONSTRAINT "certificate_exam_banks_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
