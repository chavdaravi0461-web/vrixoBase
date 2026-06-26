const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Check if any users exist
    const users = await prisma.user.findMany();
    console.log('Users found:', users.length);
    console.log(JSON.stringify(users));
  } catch (e) {
    console.error('Error querying users:', e.message);
    
    // Try raw query
    try {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      );
      console.log('Tables:', JSON.stringify(tables));
    } catch (e2) {
      console.error('Error listing tables:', e2.message);
    }
  }
  await prisma.$disconnect();
}

main();
