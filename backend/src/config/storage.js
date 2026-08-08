// ---------------------------------------------------------
// config/storage.js — S3-compatible object storage client.
//
// Built against @aws-sdk/client-s3, which works against BOTH
// real AWS S3 and Cloudflare R2 (R2 speaks the S3 API) — just
// point S3_ENDPOINT at R2's endpoint and it works unchanged.
// Currently configured for R2, chosen over S3 because R2's free
// tier (10GB storage, 1M writes + 10M reads/month) never expires
// and R2 never charges for egress — S3's free tier is 12-months-
// only and always bills for bandwidth out, which matters a lot
// for an app that serves lecture videos.
//
// Same fallback pattern as config/redis.js: if the bucket env var
// isn't set, `s3Client` is null and every caller (uploadStorage.js,
// videoUpload.middleware.js) falls back to the original local-disk
// behavior. Nothing breaks for local dev or before this is
// provisioned in production — but production SHOULD have this set,
// because Render's disk is ephemeral and uploaded files disappear
// on every redeploy/restart without it.
// ---------------------------------------------------------
const logger = require("../utils/logger");

const BUCKET = process.env.S3_BUCKET || null;
let s3Client = null;

if (BUCKET) {
  const { S3Client } = require("@aws-sdk/client-s3");

  const endpoint = process.env.S3_ENDPOINT || undefined; // set for R2 / any non-AWS S3-compatible provider
  s3Client = new S3Client({
    region: process.env.S3_REGION || "auto", // R2 uses "auto"; set a real region for AWS S3
    endpoint,
    // R2 (and most S3-compatible providers) need path-style URLs
    // instead of AWS's default virtual-hosted-style.
    forcePathStyle: !!endpoint,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });

  logger.info(`✅ Object storage configured (bucket: ${BUCKET}${endpoint ? `, endpoint: ${endpoint}` : ""})`);
} else {
  logger.warn(
    "⚠️  S3_BUCKET not set — uploads (videos, teacher documents) are saved to local disk. " +
      "This is FINE for local dev, but on Render this disk is ephemeral: files are lost on every " +
      "redeploy or restart. Set S3_BUCKET + S3_ENDPOINT + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY " +
      "(a free Cloudflare R2 bucket works) before real users start uploading files."
  );
}

// PUBLIC_BASE_URL is the domain files are served from once uploaded
// (an R2 public bucket URL, or a custom domain/CDN in front of it).
// Without it, storageKey is returned as the "url" — callers should
// treat that as "not publicly servable yet" and configure this
// before relying on uploaded-file links in production.
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || null;

module.exports = { s3Client, BUCKET, PUBLIC_BASE_URL };
