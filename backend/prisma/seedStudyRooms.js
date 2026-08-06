// ===========================================================
// prisma/seedStudyRooms.js — run once to create default rooms
// Usage: node prisma/seedStudyRooms.js
// ===========================================================

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SUBJECT_ROOMS = ["Python", "DSA", "Web Development", "Machine Learning", "General Doubts"];

async function main() {
  // Global room — only one should ever exist
  const existingGlobal = await prisma.room.findFirst({ where: { isGlobal: true } });
  if (!existingGlobal) {
    await prisma.room.create({
      data: { name: "Global Study Hall", isGlobal: true, subject: null },
    });
    console.log("✅ Created Global Study Hall");
  } else {
    console.log("ℹ️  Global room already exists, skipping");
  }

  // Subject rooms — create any that don't exist yet
  for (const subject of SUBJECT_ROOMS) {
    const existing = await prisma.room.findFirst({ where: { subject } });
    if (!existing) {
      await prisma.room.create({
        data: { name: subject, subject, isGlobal: false },
      });
      console.log(`✅ Created subject room: ${subject}`);
    } else {
      console.log(`ℹ️  Subject room "${subject}" already exists, skipping`);
    }
  }

  console.log("🎉 Study Room seeding complete");
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });