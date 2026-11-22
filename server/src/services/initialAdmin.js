import bcrypt from 'bcryptjs';
import prisma from '../db.js';

/** Create the configured administrator from private deployment environment values. */
export async function ensureConfiguredAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!email && !password) return;
  if (!email || !password) {
    console.error('Initial admin bootstrap skipped: set both INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD.');
    return;
  }
  if (password.length < 8 || password.length > 128) {
    console.error('Initial admin bootstrap skipped: INITIAL_ADMIN_PASSWORD must be between 8 and 128 characters.');
    return;
  }

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existingUser) {
    if (existingUser.role === 'ADMIN') return;
    console.error(`Initial admin bootstrap skipped: ${email} already exists with role ${existingUser.role}. Choose another admin email.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name: 'Arvo Admin',
      passwordHash: await bcrypt.hash(password, 10),
      role: 'ADMIN',
      department: 'Support Leadership',
    },
  });
  console.log(`Created initial administrator account: ${email}`);
}
