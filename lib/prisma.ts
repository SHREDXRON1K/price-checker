import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

function isConnectionError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("E57P01") || msg.includes("ECONNRESET") || msg.includes("connection");
}

function createClient() {
  const client = new PrismaClient({ log: ["error"] });

  client.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (e) {
      if (isConnectionError(e)) {
        await new Promise<void>((r) => setTimeout(r, 500));
        return next(params);
      }
      throw e;
    }
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
