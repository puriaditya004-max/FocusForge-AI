// ---------------------------------------------------------
// controllers/auth.controller.js
// signup, login, logout, and "who am I" (me).
// ---------------------------------------------------------
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/db");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

// Never send the password hash back to the frontend
function toSafeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// POST /api/auth/signup
async function signup(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are all required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
      },
    });

    const token = signToken(user);
    res.cookie("token", token, COOKIE_OPTIONS);

    return res.status(201).json({ user: toSafeUser(user), token });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Something went wrong while creating your account." });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      // Same generic message for "no user" and "wrong password" —
      // don't leak which emails are registered.
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = signToken(user);
    res.cookie("token", token, COOKIE_OPTIONS);

    return res.json({ user: toSafeUser(user), token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Something went wrong while logging in." });
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  res.clearCookie("token", COOKIE_OPTIONS);
  return res.json({ message: "Logged out successfully." });
}

// GET /api/auth/me  (requires requireAuth middleware)
async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ error: "Something went wrong." });
  }
}

module.exports = { signup, login, logout, me };