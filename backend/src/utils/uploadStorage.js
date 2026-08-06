const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_ROOT = path.resolve(__dirname, "../../uploads");

function extensionFromMime(mimeType) {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "video/mp4") return ".mp4";
  if (mimeType === "video/webm") return ".webm";
  if (mimeType === "video/quicktime") return ".mov";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  return ".bin";
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    const err = new Error("Upload must be a base64 data URL.");
    err.status = 400;
    throw err;
  }
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

function saveDataUrl(dataUrl, folder, allowedMimeTypes, maxBytes) {
  const { mimeType, buffer } = parseDataUrl(dataUrl);
  if (!allowedMimeTypes.includes(mimeType)) {
    const err = new Error(`Unsupported file type: ${mimeType}`);
    err.status = 400;
    throw err;
  }
  if (buffer.length > maxBytes) {
    const err = new Error("Uploaded file is too large.");
    err.status = 413;
    throw err;
  }

  const relativeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "");
  const absoluteFolder = path.join(UPLOAD_ROOT, relativeFolder);
  fs.mkdirSync(absoluteFolder, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extensionFromMime(mimeType)}`;
  const absolutePath = path.join(absoluteFolder, filename);
  fs.writeFileSync(absolutePath, buffer);

  const storageKey = `${relativeFolder}/${filename}`.replace(/\\/g, "/");
  return { storageKey, publicUrl: `/uploads/${storageKey}`, mimeType, size: buffer.length };
}

module.exports = { saveDataUrl, UPLOAD_ROOT };
