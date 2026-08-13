ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "preparationTrack" TEXT,
  ADD COLUMN IF NOT EXISTS "preparationOther" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

