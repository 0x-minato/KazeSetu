import { SignJWT, jwtVerify } from "jose"
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_ACCESS_SECRET,
} from "../config/env"
import { ApiError, unauthorized } from "../utils/api-error"

const algorithm = "HS256"
const accessTokenSecret = new TextEncoder().encode(JWT_ACCESS_SECRET)

export const generateAccessToken = (userId: string): Promise<string> => {
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT()
    .setProtectedHeader({ alg: algorithm, typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(accessTokenSecret)
}

export const verifyAccessToken = async (token: string): Promise<string> => {
  try {
    const { payload } = await jwtVerify(token, accessTokenSecret, {
      algorithms: [algorithm],
    })

    if (typeof payload.sub !== "string" || !payload.sub) {
      throw unauthorized("Invalid access token")
    }

    return payload.sub
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw unauthorized("Invalid or expired access token")
  }
}
