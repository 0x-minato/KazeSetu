import "dotenv/config"

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

export const PORT = process.env.PORT || 3000
export const DATABASE_URL = process.env.DATABASE_URL || ''
export const NONCE_TTL_MS = 5 * 60 * 1000
export const NODE_ENV = process.env.NODE_ENV || 'development'

export const CLOCK_SKEW_MS = 60_000
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const MAX_MESSAGE_AGE_MS = 5 * 60_000
export const SIWE_DOMAIN = requireEnv("SIWE_DOMAIN")
export const SIWE_URI = requireEnv("SIWE_URI")

const siweUrl = new URL(SIWE_URI)

if (siweUrl.protocol !== "http:" && siweUrl.protocol !== "https:") {
  throw new Error("SIWE_URI must use the http or https protocol")
}

export const CORS_ORIGIN = siweUrl.origin

export const SIWE_ALLOWED_CHAIN_IDS = requireEnv("SIWE_ALLOWED_CHAIN_IDS")
  .split(",")
  .map((value) => Number(value.trim()))

if (
  SIWE_ALLOWED_CHAIN_IDS.some(
    (chainId) => !Number.isSafeInteger(chainId) || chainId <= 0
  )
) {
  throw new Error("SIWE_ALLOWED_CHAIN_IDS must contain positive integers")
}

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const JWT_ACCESS_SECRET = requireEnv("JWT_ACCESS_SECRET")

export const AUTH_NONCE_RATE_LIMIT_WINDOW_MS = 60_000
export const AUTH_NONCE_RATE_LIMIT_MAX = 20
export const AUTH_VERIFY_RATE_LIMIT_WINDOW_MS = 60_000
export const AUTH_VERIFY_RATE_LIMIT_MAX = 10
export const AUTH_REFRESH_RATE_LIMIT_WINDOW_MS = 60_000
export const AUTH_REFRESH_RATE_LIMIT_MAX = 30
