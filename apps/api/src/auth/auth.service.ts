import { randomBytes } from "node:crypto"
import { CLOCK_SKEW_MS, MAX_MESSAGE_AGE_MS, NONCE_TTL_MS, SIWE_ALLOWED_CHAIN_IDS, SIWE_DOMAIN, SIWE_URI } from "../config/env"
import { SiweMessage } from "siwe"
import { badRequest, unauthorized } from "../utils/api-error"
import type { VerifyAuthenticationInput } from "./auth.types"

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

export const verifyAuthentication = async ({message, signature}: VerifyAuthenticationInput) => {
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
    return {
        address: parsedMessage.address.toLowerCase(),
        chainId: parsedMessage.chainId,
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