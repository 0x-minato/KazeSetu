import { prisma } from '../config/database'
import { RefreshTokenRotationConflictError } from './auth.errors'

export const findWalletByAddress = (address: string) => {
    return prisma.wallet.findUnique({
        where: {
            address
        },
        include: {
            user: {
                select: { role: true, id: true}
            }
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

export const createRefreshSessionWithToken = (
    userId: string, 
    tokenHash: string,
    expiresAt: Date
) => {
    return prisma.refreshSession.create({
        data: {
            userId,
            expiresAt,
            tokens: {
                create: {
                    tokenHash,
                    expiresAt,
                }
            }
        },
        include: {
            tokens: true
        }
    })
}

export const revokeRefreshSession = (sessionId: string) => {
    return prisma.$transaction(async (tx) => {
        const now = new Date()

        await tx.refreshSession.updateMany({
            where: {
                id: sessionId,
                revokedAt: null,
            },
            data: {
                revokedAt: now,
            },
        })

        await tx.refreshToken.updateMany({
            where: {
                sessionId,
                revokedAt: null,
            },
            data: {
                revokedAt: now,
            },
        })
    })
}

export const findRefreshTokenByHash = (tokenHash: string) => {
    return prisma.refreshToken.findUnique({
        where: {
            tokenHash
        },
        include: {
            session: {
                include: {
                    user: {
                        select: { role: true }
                    }
                }
            }
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
        const now = new Date()
        const refreshToken = await tx.refreshToken.findUnique({
            where: {
                tokenHash: oldTokenHash,
                session: {
                    userId
                }
            }
        })

        if(!refreshToken) {
            throw new RefreshTokenRotationConflictError()
        }

        const result = await tx.refreshToken.updateMany({
            where: {
                tokenHash: oldTokenHash,
                revokedAt: null,
                expiresAt: { gt: now },
                session: {
                    userId,
                    revokedAt: null,
                    expiresAt: { gt: now }
                }
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
                tokenHash: newTokenHash,
                expiresAt,
                sessionId: refreshToken.sessionId
            }
        })
    })
}

export const revokeRefreshSessionByTokenHash = (
    tokenHash: string
): Promise<boolean> => {
    return prisma.$transaction(async(tx) => {
       const token = await tx.refreshToken.findUnique({
            where: { tokenHash },
            select: { sessionId: true }
       })

       if (!token) {
            return false
       }

       await tx.refreshSession.updateMany({
            where:{
                id: token.sessionId
            },
            data: {
                revokedAt: new Date()
            }
       })

       await tx.refreshToken.updateMany({
            where:{
                sessionId: token.sessionId,
                revokedAt: null
            },
            data:{
                revokedAt: new Date()
            }
       })

       return true
    })
}
