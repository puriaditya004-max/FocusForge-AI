// ---------------------------------------------------------
// config/db.js — single shared Prisma client instance.
// Import this everywhere instead of creating `new PrismaClient()`
// in multiple files — that would open too many DB connections.
// ---------------------------------------------------------
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

module.exports = prisma;