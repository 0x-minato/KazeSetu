import "dotenv/config"
import { createPublicClient, http, type PublicClient } from "viem"

export const NODE_ENV = (process.env.NODE_ENV ?? "development").trim()
export const DATABASE_URL = (process.env.DATABASE_URL ?? "").trim()
export const REDIS_URL = (process.env.REDIS_URL ?? "redis://127.0.0.1:6379").trim()
export const REDIS_DISABLED =
  process.env.REDIS_DISABLED === "true" ||
  REDIS_URL === "" ||
  REDIS_URL.toLowerCase() === "disabled" ||
  REDIS_URL.toLowerCase() === "false"

export const ADMIN_ADDRESS = (process.env.ADMIN_ADDRESS ?? "").trim().toLowerCase()
export const DEFAULT_CHAIN_ID = Number(process.env.DEFAULT_CHAIN_ID ?? "31337") || 31337
export const DEFAULT_RPC_URL = (process.env.RPC_URL ?? "").trim()

export const POLL_INTERVAL_MS = Math.max(
  1_000,
  Number(process.env.POLL_INTERVAL_MS ?? "10000") || 10_000,
)

export const STATE_SYNC_INTERVAL_MS = Math.max(
  5_000,
  Number(process.env.STATE_SYNC_INTERVAL_MS ?? "60000") || 60_000,
)

export const MAX_BLOCK_RANGE = BigInt(
  Math.max(10, Number(process.env.MAX_BLOCK_RANGE ?? "2000") || 2_000),
)

export const START_BLOCK_OFFSET = BigInt(
  Math.max(0, Number(process.env.START_BLOCK_OFFSET ?? "1000") || 1_000),
)

export const getRpcUrlForChain = (chainId: number): string | null => {
  const specific = process.env[`RPC_URL_${chainId}`]?.trim()
  if (specific) return specific
  if (DEFAULT_RPC_URL) return DEFAULT_RPC_URL
  return null
}

const clientCache = new Map<number, PublicClient>()

export const getPublicClientForChain = (chainId: number): PublicClient | null => {
  const cached = clientCache.get(chainId)
  if (cached) return cached

  const rpcUrl = getRpcUrlForChain(chainId)
  if (!rpcUrl) return null

  const client = createPublicClient({
    transport: http(rpcUrl, {
      timeout: 15_000,
      retryCount: 2,
      retryDelay: 500,
    }),
  })

  clientCache.set(chainId, client)
  return client
}
