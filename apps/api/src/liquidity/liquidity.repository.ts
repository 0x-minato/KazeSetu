import { SwapStatus } from "../../app/generated/prisma/enums"
import { prisma } from "../config/database"

const poolWithTokensInclude = {
    pool: {
        include: {
            token0: true,
            token1: true,
        },
    },
} as const

export const getLiquidityByAddress = (address: string) => {
    return prisma.liquidityPosition.findMany({
        where: {
            wallet: { address },
            lpTokenAmount: { gt: 0 },
        },
        include: poolWithTokensInclude,
        orderBy: {
            updatedAt: "desc",
        },
    })
}

export const getLiquidityEventByAddress = (address: string) => {
    return prisma.liquidityEvent.findMany({
        where: {
            wallet: { address },
        },
        include: poolWithTokensInclude,
        orderBy: {
            createdAt: "desc",
        },
    })
}

export const getAllLiquidityEventsSuccess = () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return prisma.liquidityEvent.findMany({
        where: {
            status: SwapStatus.SUCCESS,
            createdAt: { gte: since}
        },
        select: {
            amount0: true, amount1: true,
            pool: { select: { 
                token0: {select: { price: { select: { priceUsd: true}}}}, 
                token1: {select: { price: { select: { priceUsd: true}}}}, 
            }}
        }
    })
}

export const getLiquidityEventByAddressChainIdHash = (
    address: string,
    chainId: number,
    txHash: string,
) => {
    return prisma.liquidityEvent.findFirst({
        where: {
            wallet: { address },
            chainId,
            txHash,
        },
        include: poolWithTokensInclude,
    })
}
