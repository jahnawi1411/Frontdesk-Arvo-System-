import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const email = process.argv[2]?.trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL || '';

if (!email) {
  console.error('Usage: npm run admin:promote -- <existing-customer-email>');
  process.exit(1);
}

if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
  console.error('Refusing to continue: DATABASE_URL must point to a PostgreSQL database.');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No account found for ${email}. Register that account first, then retry.`);
  }
  if (user.role === 'ADMIN') {
    console.log(`${email} already has the admin role.`);
  } else if (user.role !== 'CUSTOMER') {
    throw new Error(`Refusing to promote ${email}: current role is ${user.role}.`);
  } else {
    await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN', department: user.department || 'Support Leadership' },
    });
    console.log(`Promoted ${email} to ADMIN. Sign out and sign in again to open the staff dashboard.`);
  }
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
