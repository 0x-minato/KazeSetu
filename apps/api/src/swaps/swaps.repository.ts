import { prisma } from "../config/database"

export const getSwapsByUserId = (userId: string) => {
    return prisma.swap.findMany({
        where: {
            userId
        },
        include: swapInclude,
        orderBy: {
            createdAt: "desc"
        }
    })
}

export const getSwapByUserIdHashChainId = (userId: string, chainId: number, txHash: string) => {
    return prisma.swap.findFirst({
        where: {
            chainId,
            txHash,
            userId
        }, 
        include: swapInclude
    })
}

const swapInclude = {
    pool: {
      include: {
        token0: true,
        token1: true,
      },
    },
    tokenIn: true,
    tokenOut: true,
  } as const