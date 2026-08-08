import { prisma } from "../config/database"

export const getLiquidityByUserId = (userId: string) => {
    return prisma.liquidityPosition.findMany({
        where: {
            userId,
            lpTokenAmount: { gt: 0 }
        },
        include: {
            pool: {
                include: {
                    token0: true,
                    token1: true
                } 
            }
        },
        orderBy: {
            updatedAt: "desc"
        }
    })
} 

export const getLiquidityEventByUserId = (userId: string) => {
    return prisma.liquidityEvent.findMany({
        where: {
            userId,
        },
        include: {
            pool: {
                include: {
                    token0: true,
                    token1: true
                } 
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    })
}

export const getLiquidityEventByUserIdChainIdHash = (
    userId: string,
    chainId: number,
    txHash: string
) => {
    return prisma.liquidityEvent.findFirst({
        where: {
            userId,
            chainId,
            txHash
        },
        include: {
            pool: {
                include: {
                    token0: true,
                    token1: true
                }
            }
        }
    })
}