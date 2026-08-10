import { prisma } from "../config/database"

const activeFarmWhere = {
    isActive: true,
    pool: {
        isActive: true,
        token0: { isActive: true },
        token1: { isActive: true },
    },
    rewardToken: { isActive: true },
} as const

const farmInclude = {
    pool: {
        include: {
            token0: true,
            token1: true,
        },
    },
    rewardToken: true,
} as const

export const getAllFarmsDapp = () => {
    return prisma.stakingFarm.findMany({
        where: activeFarmWhere,
        include: farmInclude,
        orderBy: {
            createdAt: "desc",
        },
    })
}

export const getAllUserPositions = (userId: string) => {
    return prisma.stakingPosition.findMany({
        where: {
            userId,
            farm: activeFarmWhere,
            stakedAmount: { gt: 0}
        },
        include: {
            farm: {
                include: farmInclude,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    })
}

export const getAllUserFarmEvents = (userId: string) => {
    return prisma.stakingEvent.findMany({
        where: {
            userId,
        },
        include: {
            farm: {
                include: farmInclude
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    })
}

export const getEventChainIdTxHash = (
    userId: string,
    chainId: number,
    txHash: string
) => {
    return prisma.stakingEvent.findFirst({
        where: {
            userId,
            chainId,
            txHash
        },
        include: {
            farm: {
                include: farmInclude
            }
        }
    })
}

export const getFarmByAddressAndChainId = (address: string, chainId: number) => {
    return prisma.stakingFarm.findUnique({
        where: {
            chainId_address: {
                chainId,
                address,
            },
        },
        include: farmInclude,
    })
}

export const setNewFarm = (input: {
    address: string
    chainId: number
    poolId: string
    rewardTokenId: string
    isActive: boolean
}) => {
    return prisma.stakingFarm.create({
        data: {
            address: input.address,
            chainId: input.chainId,
            poolId: input.poolId,
            rewardTokenId: input.rewardTokenId,
            isActive: input.isActive,
        },
        include: farmInclude,
    })
}
