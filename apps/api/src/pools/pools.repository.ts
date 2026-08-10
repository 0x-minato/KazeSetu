import { prisma } from "../config/database"

const poolTokensInclude = {
    token0: true,
    token1: true,
} as const

export const getAllPools = () => {
    return prisma.pool.findMany({
        where: {
            isActive: true,
            token0: {
                isActive: true,
            },
            token1: {
                isActive: true,
            },
        },
        include: poolTokensInclude,
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
