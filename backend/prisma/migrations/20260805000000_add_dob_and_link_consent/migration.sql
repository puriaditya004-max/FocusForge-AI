-- Age/DOB field on User (nullable — existing accounts won't have it yet)
ALTER TABLE "users" ADD COLUMN "dateOfBirth" TIMESTAMP(3);

-- Parent-child link consent status
CREATE TYPE "LinkStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "student_parent_links" ADD COLUMN "status" "LinkStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "student_parent_links" ADD COLUMN "respondedAt" TIMESTAMP(3);

-- Existing links (created before this migration) were already active in
-- production under the old "instant link" behaviour. Grandfather them in
-- as APPROVED so we don't silently cut off parents who were already
-- legitimately linked — only NEW link requests from here on go through
-- the consent flow.
UPDATE "student_parent_links" SET "status" = 'APPROVED', "respondedAt" = "connectedAt";
