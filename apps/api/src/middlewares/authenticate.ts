import { createHash, timingSafeEqual } from "node:crypto"
import { NextFunction, Request, Response } from "express"
import { Role } from "../../app/generated/prisma/enums"
import { verifyAccessToken } from "../auth/auth.token"
import { WORKER_API_KEY } from "../config/env"
import type {} from "../types/express"
import { forbidden, unauthorized } from "../utils/api-error"

const workerKeysEqual = (provided: string, expected: string): boolean => {
  const providedHash = createHash("sha256").update(provided).digest()
  const expectedHash = createHash("sha256").update(expected).digest()
  return timingSafeEqual(providedHash, expectedHash)
}

export const authenticateAccessToken = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const authorization = req.header("authorization")
  const [scheme, token] = authorization?.split(" ") ?? []

  if (scheme !== "Bearer" || !token) {
    next(unauthorized("Access token is required"))
    return
  }

  try {
    const { role, address } = await verifyAccessToken(token)
    req.auth = { role, address }
    next()
  } catch (error) {
    next(error)
  }
}

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.auth?.role !== Role.ADMIN) {
    return next(forbidden("Admin access required"))
  }
  next()
}

export const authenticateWorkerOrAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const workerKey = req.header("x-worker-key")

  if (typeof workerKey === "string" && workerKey.length > 0) {
    if (!WORKER_API_KEY || !workerKeysEqual(workerKey, WORKER_API_KEY)) {
      next(unauthorized("Invalid worker key"))
      return
    }
    next()
    return
  }

  await authenticateAccessToken(req, res, (error?: unknown) => {
    if (error) {
      next(error)
      return
    }
    requireAdmin(req, res, next)
  })
}
