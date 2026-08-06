// ---------------------------------------------------------
// middleware/sanitize.middleware.js
// Recursively walks req.body / req.query / req.params and
// strips any HTML/script content out of string values.
// This protects features where users type free text that
// later gets rendered to OTHER users — StudyRoom chat,
// AI Mentor messages, task notes, settings/profile fields —
// which is exactly where stored-XSS attacks live.
//
// Applied globally in app.js, before routes, so every
// controller automatically gets clean input without needing
// to remember to sanitize manually each time.
// ---------------------------------------------------------
const { filterXSS } = require("xss");

function cleanValue(value) {
  if (typeof value === "string") {
    // Strip any HTML/script tags, keep plain text as-is.
    return filterXSS(value, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ["script"] }).trim();
  }
  if (Array.isArray(value)) {
    return value.map(cleanValue);
  }
  if (value && typeof value === "object") {
    const cleaned = {};
    for (const key of Object.keys(value)) {
      cleaned[key] = cleanValue(value[key]);
    }
    return cleaned;
  }
  return value;
}

function sanitizeInputs(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = cleanValue(req.body);
  }
  if (req.query && typeof req.query === "object") {
    // req.query is sometimes read-only in newer Express versions;
    // mutate keys in place instead of reassigning the object itself.
    const cleanedQuery = cleanValue(req.query);
    for (const key of Object.keys(cleanedQuery)) {
      req.query[key] = cleanedQuery[key];
    }
  }
  next();
}

module.exports = sanitizeInputs;