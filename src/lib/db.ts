import { PrismaClient } from '@prisma/client'

// SECURITY (P0-C): restrict Prisma query logging to development only.
//
// The previous configuration logged every SQL query (including user data,
// password hashes during lookup, session tokens, and student records) to
// stdout. In production this would expose sensitive data in log aggregators
// (Datadog, CloudWatch, Vercel logs, etc.).
//
// In dev we keep `query` logging because it's useful for debugging.
// In production we only log `error` and `warn` — never individual query
// parameters or result rows.

const isDev = process.env.NODE_ENV !== 'production'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: isDev
      ? ['query', 'warn', 'error']
      : ['warn', 'error'],
    // In production we also reduce information in error messages.
    ...(isDev ? {} : { errorFormat: 'minimal' as const }),
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

// Cache the client on the global object during dev to avoid creating
// multiple connections during Next.js hot-reload.
if (isDev) globalForPrisma.prisma = db
