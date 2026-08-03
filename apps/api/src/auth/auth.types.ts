export interface VerifyAuthenticationInput {
    message: string
    signature: string
}

export interface AuthenticationResult {
    userId: string
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
    userId: string
}

export interface VerifiedSiwe {
    address: string,
    chainId: number
}