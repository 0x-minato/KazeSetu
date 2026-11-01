import { PrismaClient } from "../../../api/app/generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { DATABASE_URL } from "./env.js"

const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
})

export const prisma = new PrismaClient({
  adapter,
})

export const connectDatabase = async (): Promise<void> => {
  if (!DATABASE_URL) {
    console.warn("[worker:db] DATABASE_URL is not set; skipping eager connect")
    return
  }
  await prisma.$connect()
  console.log("[worker:db] PostgreSQL connected via PrismaPg adapter")
}

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect()
}
