import { NextFunction, Request, Response } from "express"
import { forbidden, unauthorized } from "../utils/api-error"
import { verifyAccessToken } from "../auth/auth.token"
import type {} from "../types/express"
import { Role } from "../../app/generated/prisma/enums" 

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
    const { userId, role} = await verifyAccessToken(token)
    req.auth = { userId, role }
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
