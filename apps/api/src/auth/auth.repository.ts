import { prisma } from '../config/database'
import { RefreshTokenRotationConflictError } from './auth.errors'

export const findWalletByAddress = (address: string) => {
    return prisma.wallet.findUnique({
        where: {
            address
        }
    })
}

export const createUserWithWallet = (address: string) => {
    return prisma.user.create({
        data: {
            wallets: {
                create: {
                    address
                }
            }
        },
        include: {
            wallets: true
        }
    })
}

export const createRefreshToken = (tokenHash: string, userId: string, expiresAt: Date) => {
    return prisma.refreshToken.create({
        data: {
            tokenHash,
            userId,
            expiresAt
        }
    })
}

export const findRefreshTokenByHash = (tokenHash: string) => {
    return prisma.refreshToken.findUnique({
        where: {
            tokenHash
        }
    })
}

export const replaceRefreshToken = (
    oldTokenHash: string,
    newTokenHash: string,
    userId: string,
    expiresAt: Date
) => {
    return prisma.$transaction(async(tx) => {
        const result = await tx.refreshToken.updateMany({
            where: {
                userId,
                tokenHash: oldTokenHash,
                revokedAt: null,
                expiresAt: { gt: new Date() }
            },
            data: {
                revokedAt: new Date()
            }
        })

        if (result.count !== 1) {
            throw new RefreshTokenRotationConflictError()
        }

        return tx.refreshToken.create({
            data: {
                userId,
                tokenHash: newTokenHash,
                expiresAt
            }
        })
    })
}

export const revokeRefreshTokenByHash = async (tokenHash: string) => {
    return prisma.refreshToken.updateMany({
        where: {
            tokenHash,
            revokedAt: null
        },
        data: {
            revokedAt: new Date()
        }
    })
}

export const revokeAllTokensByUser = (userId: string) => {
    return prisma.refreshToken.updateMany({
        where: {
            userId,
            revokedAt: null
        },
        data: {
            revokedAt: new Date()
        }
    })
}

export const deleteExpiredRefreshTokens = () => {
    return prisma.refreshToken.deleteMany({
        where: {
            expiresAt: { lte: new Date() }
        }
    })
}