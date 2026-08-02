import { createHash, randomBytes } from "node:crypto"
import { Prisma } from "../../app/generated/prisma/client.js"
import { 
  CLOCK_SKEW_MS, 
  MAX_MESSAGE_AGE_MS, 
  NONCE_TTL_MS, 
  SIWE_ALLOWED_CHAIN_IDS, 
  SIWE_DOMAIN, 
  SIWE_URI,
  REFRESH_TOKEN_TTL_MS 
} from "../config/env"
import { SiweMessage } from "siwe"
import { badRequest, unauthorized } from "../utils/api-error"
import type {
  AuthenticationResult,
  RefreshTokenRotationResult,
  VerifyAuthenticationInput
} from "./auth.types"
import { RefreshTokenRotationConflictError } from "./auth.errors"
import { 
  createRefreshSessionWithToken, 
  createUserWithWallet, 
  findRefreshTokenByHash, 
  findWalletByAddress, 
  replaceRefreshToken, 
  revokeRefreshSession, 
  revokeRefreshSessionByTokenHash 
} from "./auth.repository"
import { generateAccessToken } from "./auth.token"

type RefreshTokenWithSession = NonNullable<
Awaited<ReturnType<typeof findRefreshTokenByHash>>>

const nonceStore = new Map<string, number>()
export const generateNonce = (): string => {
    const nonce = randomBytes(16).toString("hex")
    const expiresAt = Date.now() + NONCE_TTL_MS

    nonceStore.set(nonce, expiresAt)

    return nonce
}

const consumeNonce = (nonce: string): boolean => {
    const expiresAt = nonceStore.get(nonce)

    nonceStore.delete(nonce)

    return expiresAt !== undefined && expiresAt > Date.now()
}

export const verifyAuthentication = async (
  {message, signature}: VerifyAuthenticationInput
): Promise<AuthenticationResult> => {
    let parsedMessage: SiweMessage
    try {
        parsedMessage = new SiweMessage(message)
    } catch {
       throw badRequest("Invalid SIWE message")
    }

    validateSiweContext(parsedMessage)

    try {
        const verification = await parsedMessage.verify({
            signature,
            domain: SIWE_DOMAIN,
            time: new Date().toISOString() 
        })
        if (!verification.success) {
          throw unauthorized("Invalid SIWE signature")
        }
    } catch {
        throw unauthorized("Invalid SIWE signature")
    }
    if (!consumeNonce(parsedMessage.nonce)) {
        throw unauthorized("Invalid, expired, or previously used nonce")
    }
    const normalizedAddress = parsedMessage.address.toLowerCase()

    const userId = await findOrCreateUserByWalletAddress(normalizedAddress)

    const accessToken = await generateAccessToken(userId)
    const refreshToken = randomBytes(32).toString("base64url")

    const refreshTokenHash = createHash("sha256")
      .update(refreshToken)
      .digest("hex")

    const refreshTokenExpiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_MS
    )

    await createRefreshSessionWithToken(
      userId,
      refreshTokenHash,
      refreshTokenExpiresAt
    )

    return {
        userId,
        address: normalizedAddress,
        chainId: parsedMessage.chainId,
        accessToken,
        refreshToken,
        refreshTokenExpiresAt,
    }
}

const validateSiweContext = (message: SiweMessage) => {
  const now = Date.now()

  if (message.domain !== SIWE_DOMAIN) {
    throw unauthorized("Invalid SIWE context")
  }

  if (message.uri !== SIWE_URI) {
    throw unauthorized("Invalid SIWE context")
  }

  if (!SIWE_ALLOWED_CHAIN_IDS.includes(message.chainId)) {
    throw badRequest("Unsupported SIWE chain")
  }

  if (!message.issuedAt) {
    throw badRequest("SIWE issued-at timestamp is missing")
  }

  const issuedAt = Date.parse(message.issuedAt)

  if (Number.isNaN(issuedAt)) {
    throw badRequest("Invalid SIWE issued-at timestamp")
  }

  if (
    issuedAt > now + CLOCK_SKEW_MS ||
    issuedAt < now - MAX_MESSAGE_AGE_MS
  ) {
    throw unauthorized("Invalid SIWE timestamp")
  }

  if (message.expirationTime) {
    const expirationTime = Date.parse(message.expirationTime)

    if (Number.isNaN(expirationTime)) {
      throw badRequest("Invalid SIWE expiration timestamp")
    }

    if (expirationTime < now - CLOCK_SKEW_MS) {
      throw unauthorized("SIWE message has expired")
    }
  }

  if (message.notBefore) {
    const notBefore = Date.parse(message.notBefore)

    if (Number.isNaN(notBefore)) {
      throw badRequest("Invalid SIWE not-before timestamp")
    }

    if (notBefore > now + CLOCK_SKEW_MS) {
      throw unauthorized("SIWE message is not active yet")
    }
  }
}

export const replaceRefreshTokenService = async (
  refreshTokenCookie: string
): Promise<RefreshTokenRotationResult> => {
  const refreshTokenHash = createHash("sha256")
    .update(refreshTokenCookie)
    .digest("hex")
  const refreshTokenDB = await findRefreshTokenByHash(refreshTokenHash)

  const validatedRefreshToken = await validateRefreshTokenForRotation(refreshTokenDB)

  const userId = validatedRefreshToken.session.userId
  const newAccessToken = await generateAccessToken(userId)
  const newRefreshToken = randomBytes(32).toString("base64url")
  const newRefreshTokenHash = createHash("sha256")
    .update(newRefreshToken)
    .digest("hex")

  const newRefreshTokenExpiresAt = new Date(
    Math.min(
      Date.now() + REFRESH_TOKEN_TTL_MS,
      validatedRefreshToken.session.expiresAt.getTime(),
    ),
  )

  try {
    await replaceRefreshToken(
      refreshTokenHash,
      newRefreshTokenHash,
      userId,
      newRefreshTokenExpiresAt
    )
  } catch (error) {
    if (!(error instanceof RefreshTokenRotationConflictError)) {
      throw error
    }

    const refreshTokenDB = await findRefreshTokenByHash(refreshTokenHash)
    await validateRefreshTokenForRotation(refreshTokenDB)

    throw error
  }

  return {
    newRefreshToken,
    newAccessToken,
    refreshTokenExpiresAt: newRefreshTokenExpiresAt,
  }
}

export const logoutService = async(refreshTokenCookie: string): Promise<void> => {
  const refreshTokenHash = createHash("sha256")
    .update(refreshTokenCookie)
    .digest("hex")
  await revokeRefreshSessionByTokenHash(refreshTokenHash)
}


const findOrCreateUserByWalletAddress = async (
  address: string,
): Promise<string> => {
  const existingWallet = await findWalletByAddress(address)

  if (existingWallet) {
    return existingWallet.userId
  }

  try {
    const user = await createUserWithWallet(address)
    return user.id
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const concurrentlyCreatedWallet =
        await findWalletByAddress(address)

      if (concurrentlyCreatedWallet) {
        return concurrentlyCreatedWallet.userId
      }
    }

    throw error
  }
}

const validateRefreshTokenForRotation = async (
  refreshToken: RefreshTokenWithSession | null,
): Promise<RefreshTokenWithSession> => {
  if (!refreshToken) {
    throw unauthorized("Invalid refresh token")
  }

  if (refreshToken.session.revokedAt) {
    throw unauthorized("Refresh session is revoked")
  }

  if (refreshToken.session.expiresAt <= new Date()) {
    throw unauthorized("Refresh session has expired")
  }

  if (refreshToken.revokedAt) {
    await revokeRefreshSession(refreshToken.sessionId)
    throw unauthorized("Refresh token reuse detected")
  }

  if (refreshToken.expiresAt <= new Date()) {
    throw unauthorized("Refresh Token is invalid or expired")
  }

  return refreshToken
}