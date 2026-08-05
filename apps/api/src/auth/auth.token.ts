import { SignJWT, jwtVerify } from "jose"
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_ACCESS_SECRET,
} from "../config/env"
import { ApiError, unauthorized } from "../utils/api-error"
import { Role } from "../../app/generated/prisma/enums"
import { UserIdRole } from "./auth.types"

const algorithm = "HS256"
const accessTokenSecret = new TextEncoder().encode(JWT_ACCESS_SECRET)

export const generateAccessToken = (userId: string, role: Role): Promise<string> => {
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({ role })
    .setProtectedHeader({ alg: algorithm, typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(accessTokenSecret)
}

export const verifyAccessToken = async (token: string): Promise<UserIdRole> => {
  try {
    const { payload } = await jwtVerify(token, accessTokenSecret, {
      algorithms: [algorithm],
    })

    const role = payload.role
    if (
      typeof payload.sub !== "string" || 
      !payload.sub || 
      (role !== Role.ADMIN && 
      role !== Role.USER)
    ) {
      throw unauthorized("Invalid access token")
    } 

    return { 
      userId: payload.sub, 
      role
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw unauthorized("Invalid or expired access token")
  }
}
