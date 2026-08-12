-- Add sourceId used by the penalty auto-detection logic to avoid
-- duplicate penalties for the same task, focus session, or streak break.
ALTER TABLE "penalty_events" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

CREATE INDEX IF NOT EXISTS "penalty_events_userId_type_sourceId_idx"
ON "penalty_events"("userId", "type", "sourceId");
