import "dotenv/config"

export const PORT = process.env.PORT || 3000
export const DATABASE_URL = process.env.DATABASE_URL || ''
export const NONCE_TTL_MS = 5 * 60 * 1000
export const NODE_ENV = process.env.NODE_ENV || 'development'

export const CLOCK_SKEW_MS = 60_000
export const MAX_MESSAGE_AGE_MS = 5 * 60_000
export const SIWE_DOMAIN = process.env.SIWE_DOMAIN!
export const SIWE_URI = process.env.SIWE_URI!
export const SIWE_ALLOWED_CHAIN_IDS = (
  process.env.SIWE_ALLOWED_CHAIN_IDS ?? ""
)
  .split(",")
  .map(Number)