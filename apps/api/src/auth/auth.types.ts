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
}

export interface RefreshTokenRotationResult {
    newAccessToken: string
    newRefreshToken: string
}

export interface AuthenticatedUser {
    userId: string
}