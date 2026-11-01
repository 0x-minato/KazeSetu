import "dotenv/config"

export const NODE_ENV = (process.env.NODE_ENV ?? "development").trim()
export const DATABASE_URL = (process.env.DATABASE_URL ?? "").trim()
export const REDIS_URL = (process.env.REDIS_URL ?? "redis://127.0.0.1:6379").trim()
export const API_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:3000")
  .trim()
  .replace(/\/+$/, "")
export const WORKER_API_KEY = (process.env.WORKER_API_KEY ?? "").trim()
export const ADMIN_ADDRESS = (process.env.ADMIN_ADDRESS ?? "").trim().toLowerCase()
export const DEFAULT_CHAIN_ID = Number(process.env.DEFAULT_CHAIN_ID ?? "31337") || 31337
export const DEFAULT_RPC_URL = (process.env.RPC_URL ?? "").trim()
export const SYNC_INTERVAL_MS = Math.max(
  10_000,
  Number(process.env.SYNC_INTERVAL_MS ?? "60000") || 60_000,
)

export const getRpcUrlForChain = (chainId: number): string | null => {
  const specific = process.env[`RPC_URL_${chainId}`]?.trim()
  if (specific) return specific
  if (DEFAULT_RPC_URL) return DEFAULT_RPC_URL
  return null
}
