DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OtpChannel') THEN
    CREATE TYPE "OtpChannel" AS ENUM ('EMAIL', 'MOBILE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DigitalIdStatus') THEN
    CREATE TYPE "DigitalIdStatus" AS ENUM ('ACTIVE', 'REVOKED');
  END IF;
END
$$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mobileNumber" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mobileVerifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "otp_challenges" (
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

CREATE INDEX IF NOT EXISTS "otp_challenges_target_channel_purpose_idx"
  ON "otp_challenges"("target", "channel", "purpose");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'otp_challenges_userId_fkey'
  ) THEN
    ALTER TABLE "otp_challenges"
      ADD CONSTRAINT "otp_challenges_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "digital_ids" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cardNumber" TEXT NOT NULL,
  "verifyToken" TEXT NOT NULL,
  "status" "DigitalIdStatus" NOT NULL DEFAULT 'ACTIVE',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  CONSTRAINT "digital_ids_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "digital_ids_userId_key" ON "digital_ids"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "digital_ids_cardNumber_key" ON "digital_ids"("cardNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "digital_ids_verifyToken_key" ON "digital_ids"("verifyToken");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'digital_ids_userId_fkey'
  ) THEN
    ALTER TABLE "digital_ids"
      ADD CONSTRAINT "digital_ids_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
