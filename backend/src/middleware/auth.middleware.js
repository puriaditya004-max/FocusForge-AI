// ---------------------------------------------------------
// middleware/auth.middleware.js
// Verifies the JWT sent by the frontend (as an httpOnly cookie
// OR as a Bearer token — both supported) and attaches the
// decoded user info to req.user. Use this on any route that
// needs a logged-in user (basically everything except
// /api/auth/signup and /api/auth/login).
// ---------------------------------------------------------
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  try {
    // Support both cookie-based and header-based tokens so the
    // same middleware works for a browser client and, later,
    // a mobile client if needed.
    const cookieToken = req.cookies?.token;
    const headerToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null;

    const token = cookieToken || headerToken;

    if (!token) {
      return res.status(401).json({ error: "Not authenticated. Please log in." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded = { userId, role }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

// Optional: restrict a route to a specific role (e.g. future Parent routes)
function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: "You don't have permission to do this." });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };