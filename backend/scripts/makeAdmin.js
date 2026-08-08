// ---------------------------------------------------------
// scripts/makeAdmin.js — promotes an existing user to ADMIN.
//
// Signup deliberately rejects role: "ADMIN" at account creation
// (security-by-design — nobody should be able to self-register as
// admin from the public signup form). This script is the ONLY
// supported way to grant admin access: the person must already
// have a normal account (sign up as STUDENT/PARENT/TEACHER first),
// then a trusted operator runs this against the database directly.
//
// Usage (from backend/):
//   npm run make-admin -- someone@example.com
//
// Works against whatever DATABASE_URL is in backend/.env — so run
// this locally against the LOCAL db, or with the production
// DATABASE_URL temporarily set in your environment to promote a
// user on the live (Render/Neon) database. Never commit real
// production credentials into this file.
// ---------------------------------------------------------
// Standalone script — unlike src/server.js, nothing else loads .env
// for us here, so we load it explicitly before touching prisma.
require("dotenv").config();

const prisma = require("../src/config/db");

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: npm run make-admin -- someone@example.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`No user found with email "${email}". They must sign up first (as any role), then re-run this script.`);
    process.exit(1);
  }

  if (user.role === "ADMIN") {
    console.log(`"${email}" is already an ADMIN. Nothing to do.`);
    process.exit(0);
  }

  const previousRole = user.role;

  const updated = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });

  console.log(`Done. "${updated.email}" promoted from ${previousRole} → ADMIN.`);
  console.log(`They can now log in at the admin-app (e.g. http://localhost:5174/login).`);
}

main()
  .catch((err) => {
    console.error("make-admin failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });