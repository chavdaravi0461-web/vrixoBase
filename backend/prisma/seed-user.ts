import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "users" (id, email, name, "passwordHash", role, "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    'cmqtezbgd0009smcxhkcgqkxf',
    'ravi.test@example.com',
    'Ravi',
    '$2b$10$dummyhash',
    'user',
    true,
  );

  const user = await prisma.user.findUnique({ where: { id: 'cmqtezbgd0009smcxhkcgqkxf' } });
  console.log(JSON.stringify(user, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
