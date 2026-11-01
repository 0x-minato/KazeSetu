import { PrismaClient, Prisma, Role } from "../../../../apps/api/app/generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { ADMIN_ADDRESS, DATABASE_URL } from "./env.js"

const pool = new pg.Pool({
  connectionString: DATABASE_URL || undefined,
})

const adapter = new PrismaPg(pool)

export const prisma = new PrismaClient({
  adapter,
})

export { Prisma, Role }

export type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0]

export type DbClient = typeof prisma | TransactionClient

export function getDbClient(db?: DbClient): DbClient {
  return db ?? prisma
}

export const connectDatabase = async (): Promise<void> => {
  if (!DATABASE_URL) {
    console.warn("[indexer:db] DATABASE_URL is not set; skipping eager connect")
    return
  }
  await prisma.$connect()
  console.log("[indexer:db] PostgreSQL connected via PrismaPg adapter")
}

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect()
  await pool.end().catch(() => undefined)
}

export const normalizeAddress = (address: string): string =>
  address.trim().toLowerCase()

export const normalizeTxHash = (txHash?: string | null): string | null => {
  if (!txHash) return null
  const normalized = txHash.trim().toLowerCase()
  return /^0x[a-f0-9]{64}$/.test(normalized) ? normalized : null
}

export const upsertWallet = async (address: string, db?: DbClient) => {
  const client = getDbClient(db)
  const normalized = normalizeAddress(address)
  const role: Role =
    ADMIN_ADDRESS.length > 0 && normalized === ADMIN_ADDRESS
      ? Role.ADMIN
      : Role.USER

  return client.wallet.upsert({
    where: { address: normalized },
    create: {
      address: normalized,
      role,
    },
    update:
      ADMIN_ADDRESS.length > 0 && normalized === ADMIN_ADDRESS
        ? { role: Role.ADMIN }
        : {},
  })
}

export const getIndexerCursor = async (
  chainId: number,
  contractAddress: string,
  db?: DbClient,
): Promise<bigint | null> => {
  const client = getDbClient(db)
  const normalized = normalizeAddress(contractAddress)
  const cursor = await client.indexerCursor.findUnique({
    where: {
      chainId_contractAddress: {
        chainId,
        contractAddress: normalized,
      },
    },
  })
  return cursor ? cursor.lastBlock : null
}

export const saveIndexerCursor = async (
  chainId: number,
  contractAddress: string,
  lastBlock: bigint,
  db?: DbClient,
): Promise<void> => {
  const client = getDbClient(db)
  const normalized = normalizeAddress(contractAddress)
  await client.indexerCursor.upsert({
    where: {
      chainId_contractAddress: {
        chainId,
        contractAddress: normalized,
      },
    },
    create: {
      chainId,
      contractAddress: normalized,
      lastBlock,
    },
    update: {
      lastBlock,
    },
  })
}
