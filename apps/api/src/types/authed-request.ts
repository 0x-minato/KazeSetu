import type { Request } from "express"
import type { AuthenticatedUser } from "../auth/auth.types"

export type AuthedRequest = Request & { auth: AuthenticatedUser }

export const getAuth = (req: Request): AuthenticatedUser =>
  (req as AuthedRequest).auth
