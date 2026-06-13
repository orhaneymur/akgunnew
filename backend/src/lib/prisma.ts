import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL ortam değişkeni tanımlı değil.');
}

const adapter = new PrismaMariaDb(connectionString);

export const prisma = new PrismaClient({ adapter });
