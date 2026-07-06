import { NODE_ENV, LOG_DATABASE } from '@/config';
import { PrismaClient } from '@/prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more:
// https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const log: ('info' | 'query' | 'warn' | 'error')[] = LOG_DATABASE ? ['query', 'info', 'warn', 'error'] : [];

function createPrismaClient() {
  return new PrismaClient({ log }).$extends({
    query: {},
  });
}

let prisma = globalForPrisma.prisma ?? createPrismaClient();

// After prisma generate, Next dev can keep a stale global client missing new models.
if (NODE_ENV !== 'production' && !('cloudCostAccountabilityState' in prisma)) {
  prisma = createPrismaClient();
}

if (NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
