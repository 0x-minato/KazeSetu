import { prisma } from "../config/database"

const activeVaultWhere = {
    isActive: true,
    pool: {
        isActive: true,
        token0: { isActive: true },
        token1: { isActive: true },
    },
} as const

const vaultInclude = {
    pool: {
        include: {
            token0: true,
            token1: true,
        },
    },
} as const

export const getAllActiveVaults = () => {
    return prisma.clVault.findMany({
        where: activeVaultWhere,
        include: vaultInclude,
        orderBy: {
            createdAt: "desc",
        },
    })
}

export const getVaultByAddressAndChainId = (address: string, chainId: number) => {
    return prisma.clVault.findUnique({
        where: {
            chainId_address: {
                chainId,
                address,
            },
        },
        include: vaultInclude,
    })
}

export const getUserVaultPositions = (address: string) => {
    return prisma.vaultPosition.findMany({
        where: {
            wallet: { address },
            vault: activeVaultWhere,
            shares: { gt: 0 },
        },
        include: {
            vault: {
                include: vaultInclude,
            },
        },
        orderBy: {
            updatedAt: "desc",
        },
    })
}

export const getUserVaultEvents = (address: string) => {
    return prisma.vaultEvent.findMany({
        where: {
            wallet: { address },
        },
        include: {
            vault: {
                include: vaultInclude,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    })
}

export const getVaultEvents24HrSuccess = () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return prisma.vaultEvent.findMany({
        where: {
            status: "SUCCESS",
            type: { in: ["DEPOSIT", "WITHDRAW"] },
            createdAt: { gte: since },
        },
        include: {
            vault: {
                include: {
                    pool: {
                        include: {
                            token0: { include: { price: true } },
                            token1: { include: { price: true } },
                        },
                    },
                },
            },
        },
    })
}

export const getUserVaultEventByTxHashAndChainId = (
    address: string,
    chainId: number,
    txHash: string,
) => {
    return prisma.vaultEvent.findFirst({
        where: {
            wallet: { address },
            chainId,
            txHash,
        },
        include: {
            vault: {
                include: vaultInclude,
            },
        },
    })
}

export const createClVault = (input: {
    address: string
    chainId: number
    name: string
    symbol: string
    poolId: string
    managerAddress: string
    swapRouterAddress: string
    fee: number
    tickLower: number
    tickUpper: number
    tokenId: string
    liquidity: string
    amount0: string
    amount1: string
    totalSupply: string
    sqrtPriceX96: string
    currentTick: number
    isPaused: boolean
    isActive: boolean
}) => {
    return prisma.clVault.create({
        data: {
            address: input.address,
            chainId: input.chainId,
            name: input.name,
            symbol: input.symbol,
            poolId: input.poolId,
            managerAddress: input.managerAddress,
            swapRouterAddress: input.swapRouterAddress,
            fee: input.fee,
            tickLower: input.tickLower,
            tickUpper: input.tickUpper,
            tokenId: input.tokenId,
            liquidity: input.liquidity,
            amount0: input.amount0,
            amount1: input.amount1,
            totalSupply: input.totalSupply,
            sqrtPriceX96: input.sqrtPriceX96,
            currentTick: input.currentTick,
            isPaused: input.isPaused,
            isActive: input.isActive,
        },
        include: vaultInclude,
    })
}

export const updateClVaultState = (input: {
    address: string
    chainId: number
    tickLower?: number
    tickUpper?: number
    currentTick?: number
    sqrtPriceX96?: string
    tokenId?: string
    liquidity: string
    amount0: string
    amount1: string
    totalSupply: string
    isPaused?: boolean
    isActive?: boolean
}) => {
    return prisma.clVault.update({
        where: {
            chainId_address: {
                chainId: input.chainId,
                address: input.address,
            },
        },
        data: {
            liquidity: input.liquidity,
            amount0: input.amount0,
            amount1: input.amount1,
            totalSupply: input.totalSupply,
            ...(input.tickLower === undefined ? {} : { tickLower: input.tickLower }),
            ...(input.tickUpper === undefined ? {} : { tickUpper: input.tickUpper }),
            ...(input.currentTick === undefined ? {} : { currentTick: input.currentTick }),
            ...(input.sqrtPriceX96 === undefined ? {} : { sqrtPriceX96: input.sqrtPriceX96 }),
            ...(input.tokenId === undefined ? {} : { tokenId: input.tokenId }),
            ...(input.isPaused === undefined ? {} : { isPaused: input.isPaused }),
            ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
        include: vaultInclude,
    })
}
