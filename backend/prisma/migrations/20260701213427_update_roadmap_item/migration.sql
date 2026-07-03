/*
  Warnings:

  - You are about to drop the column `duration` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `time` on the `tasks` table. All the data in the column will be lost.
  - Added the required column `monthLabel` to the `roadmap_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "roadmap_items" ADD COLUMN     "hours" TEXT,
ADD COLUMN     "monthLabel" TEXT NOT NULL,
ADD COLUMN     "project" TEXT,
ADD COLUMN     "tools" TEXT;

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "duration",
DROP COLUMN "time";
