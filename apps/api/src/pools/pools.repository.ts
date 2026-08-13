import { prisma } from "../config/database"

const poolTokensInclude = {
    token0: true,
    token1: true,
} as const

const activePool = {
    isActive: true,
    token0: {
        isActive: true,
    },
    token1: {
        isActive: true,
    },
}

export const getAllPools = () => {
    return prisma.pool.findMany({
        where: activePool,
        include: poolTokensInclude,
    })
}

export const getAllPoolsForTvl = () => {
    return prisma.pool.findMany({
        where: activePool,
        select: {
            reserve0: true, reserve1: true,
            token0: { select: { price: { select: { priceUsd: true}}}},
            token1: { select: { price: { select: { priceUsd: true}}}},
        }
    })
}

export const getPoolByAddressAndChainId = (address: string, chainId: number) => {
    return prisma.pool.findUnique({
        where: {
            chainId_address: {
                chainId,
                address,
            },
        },
        include: poolTokensInclude,
    })
}

export const setNewPool = (input: {
    address: string
    chainId: number
    token0Id: string
    token1Id: string
    feeBps: number
    reserve0: string
    reserve1: string
    isActive: boolean
}) => {
    return prisma.pool.create({
        data: {
            address: input.address,
            chainId: input.chainId,
            token0Id: input.token0Id,
            token1Id: input.token1Id,
            feeBps: input.feeBps,
            reserve0: input.reserve0,
            reserve1: input.reserve1,
            isActive: input.isActive,
        },
        include: poolTokensInclude,
    })
}
