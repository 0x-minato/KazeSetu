import { SwapStatus } from "../../app/generated/prisma/enums"
import { prisma } from "../config/database"

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

export const getSwapsByAddress = (address: string) => {
    return prisma.swap.findMany({
        where: {
            wallet: { address },
        },
        include: swapInclude,
        orderBy: {
            createdAt: "desc",
        },
    })
}

export const getAllSwaps24Hr = () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return prisma.swap.findMany({
        where: {
            status: SwapStatus.SUCCESS,
            createdAt: { gte: since}
        }, 
        select: {
            amountIn: true,
            tokenIn: {
                select: {
                    address: true,
                    price: { select: { priceUsd: true }}
                }
            }
        }
    })
}

export const getSwapByAddressHashChainId = (address: string, chainId: number, txHash: string) => {
    return prisma.swap.findFirst({
        where: {
            chainId,
            txHash,
            wallet: { address },
        },
        include: swapInclude,
    })
}
