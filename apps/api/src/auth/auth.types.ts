import { Role } from '../../app/generated/prisma/client'

export interface VerifyAuthenticationInput {
    message: string
    signature: string
}

export interface AuthenticationResult {
    address: string
    chainId: number
    accessToken: string
    refreshToken: string
    refreshTokenExpiresAt: Date
}

export interface RefreshTokenRotationResult {
    newAccessToken: string
    newRefreshToken: string
    refreshTokenExpiresAt: Date
}

export interface AuthenticatedUser {
    address: string
    role: Role
}

export interface VerifiedSiwe {
    address: string
    chainId: number
}

export interface AddressRole {
    address: string
    role: Role
}
