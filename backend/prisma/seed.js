/**
 * Database Seed Script
 * Populates database with realistic demo data
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.task.deleteMany();
  await prisma.rFP.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  console.log('Creating users...');
  
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = await Promise.all([
    // Master Admin User
    prisma.user.create({
      data: {
        email: 'sarah.johnson@gmail.com', // Explicit requested admin
        password: hashedPassword,
        firstName: 'Sarah',
        lastName: 'Johnson',
        role: 'PROPOSAL_MANAGER'
      }
    })
  ]);

  console.log(`✅ Created 1 Master Admin user`);

  console.log('\n🎉 Database reset successfully!');
  console.log('\n📧 Demo Admin Credentials:');
  console.log('   Email: sarah.johnson@gmail.com');
  console.log('   Password: password123');
  console.log('   Role: Proposal Manager\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
