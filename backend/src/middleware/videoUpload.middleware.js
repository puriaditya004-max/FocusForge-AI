// ---------------------------------------------------------
// videoUpload.middleware.js — multipart/form-data upload for
// full-length course videos.
//
// Why not the existing base64-JSON path (uploadStorage.saveDataUrl)?
// That reads the whole request body into memory as JSON before
// anything runs, capped by express.json's 10mb limit -- fine for
// documents/images, but a real lecture video (up to 250MB, per
// VIDEO_MIMES/MAX_VIDEO_BYTES in teacher.controller.js) would
// either get rejected by the body limit or block the event loop
// parsing a huge JSON string. multer streams the file straight
// to disk in chunks instead, so memory use stays flat regardless
// of file size.
//
// Always lands in a TEMP folder now (uploads/tmp/), regardless of
// whether S3/R2 is configured. The controller (uploadCourseVideo)
// decides what happens next:
//   - S3_BUCKET set: stream the temp file up to R2/S3, then delete
//     the temp file -- the on-disk copy only ever exists for the
//     duration of one request, so Render's ephemeral disk is a
//     non-issue here.
//   - S3_BUCKET not set: move the temp file into the old permanent
//     uploads/course-videos/<courseId>/ folder -- exact same
//     behavior as before this change.
// ---------------------------------------------------------
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { UPLOAD_ROOT } = require("../utils/uploadStorage");

const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

const EXT_BY_MIME = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

const TEMP_DIR = path.join(UPLOAD_ROOT, "tmp");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname) || ".bin";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!VIDEO_MIMES.includes(file.mimetype)) {
    return cb(new Error(`Unsupported video type: ${file.mimetype}`));
  }
  cb(null, true);
}

const videoUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
});

// Wraps multer's `.single("video")` so its errors (file too large,
// wrong type, etc.) come back as the same { error: "..." } JSON shape
// as every other route in this app, instead of multer's default
// stack-trace-y error page.
function uploadSingleVideo(req, res, next) {
  videoUpload.single("video")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: `Video must be under ${MAX_VIDEO_BYTES / (1024 * 1024)}MB.` });
    }
    return res.status(400).json({ error: err.message || "Video upload failed." });
  });
}

module.exports = { uploadSingleVideo, MAX_VIDEO_BYTES, VIDEO_MIMES, TEMP_DIR };
