import { prisma } from "../config/database"

const poolWithTokensInclude = {
    pool: {
        include: {
            token0: true,
            token1: true,
        },
    },
} as const

export const getLiquidityByUserId = (userId: string) => {
    return prisma.liquidityPosition.findMany({
        where: {
            userId,
            lpTokenAmount: { gt: 0 },
        },
        include: poolWithTokensInclude,
        orderBy: {
            updatedAt: "desc",
        },
    })
}

export const getLiquidityEventByUserId = (userId: string) => {
    return prisma.liquidityEvent.findMany({
        where: {
            userId,
        },
        include: poolWithTokensInclude,
        orderBy: {
            createdAt: "desc",
        },
    })
}

export const getLiquidityEventByUserIdChainIdHash = (
    userId: string,
    chainId: number,
    txHash: string,
) => {
    return prisma.liquidityEvent.findFirst({
        where: {
            userId,
            chainId,
            txHash,
        },
        include: poolWithTokensInclude,
    })
}
