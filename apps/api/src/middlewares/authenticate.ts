import { NextFunction, Request, Response } from "express"
import { unauthorized } from "../utils/api-error"
import { verifyAccessToken } from "../auth/auth.token"
import type {} from "../types/express"

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
    const userId = await verifyAccessToken(token)
    req.auth = { userId }
    next()
  } catch (error) {
    next(error)
  }
}
