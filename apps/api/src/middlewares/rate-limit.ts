import rateLimit from "express-rate-limit"
import {
  AUTH_NONCE_RATE_LIMIT_MAX,
  AUTH_NONCE_RATE_LIMIT_WINDOW_MS,
  AUTH_REFRESH_RATE_LIMIT_MAX,
  AUTH_REFRESH_RATE_LIMIT_WINDOW_MS,
  AUTH_VERIFY_RATE_LIMIT_MAX,
  AUTH_VERIFY_RATE_LIMIT_WINDOW_MS,
} from "../config/env"
import { tooManyRequests } from "../utils/api-error"

const createAuthRateLimiter = (
  windowMs: number,
  max: number,
  message: string,
) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(tooManyRequests(message))
    },
  })

export const nonceRateLimiter = createAuthRateLimiter(
  AUTH_NONCE_RATE_LIMIT_WINDOW_MS,
  AUTH_NONCE_RATE_LIMIT_MAX,
  "Too many nonce requests",
)

export const verifyRateLimiter = createAuthRateLimiter(
  AUTH_VERIFY_RATE_LIMIT_WINDOW_MS,
  AUTH_VERIFY_RATE_LIMIT_MAX,
  "Too many authentication attempts",
)

export const refreshRateLimiter = createAuthRateLimiter(
  AUTH_REFRESH_RATE_LIMIT_WINDOW_MS,
  AUTH_REFRESH_RATE_LIMIT_MAX,
  "Too many refresh requests",
)
