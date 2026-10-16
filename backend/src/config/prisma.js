import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

// Support JSON serialization of BigInt fields from Prisma
BigInt.prototype.toJSON = function () {
  return this.toString();
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
