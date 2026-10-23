import { PrismaClient } from '../generated/prisma';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@elyvion.dev';
  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, name: 'Demo User' },
    update: { passwordHash },
  });

  console.log(`Seeded demo user: ${user.email} / password: ChangeMe123!`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
