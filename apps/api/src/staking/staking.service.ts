import { getActivePoolByAddressAndChainId } from "../pools/pools.service"
import { toPool } from "../pools/pools.mapper"
import { getActiveTokenByAddressAndChainId } from "../tokens/tokens.service"
import { toToken } from "../tokens/tokens.mapper"
import { conflict, notFound } from "../utils/api-error"
import { FarmBodyDTO } from "./staking.dto"
import {
    getAllFarmsDapp,
    getAllUserFarmEvents,
    getAllUserPositions,
    getEventChainIdTxHash,
    getFarmByAddressAndChainId,
    setNewFarm,
} from "./staking.repository"
import { FarmData, StakingEvent, StakingPosition } from "./staking.types"

type FarmFromRepo = NonNullable<Awaited<ReturnType<typeof getFarmByAddressAndChainId>>>
type PositionFromRepo = Awaited<ReturnType<typeof getAllUserPositions>>[number]
type EventFromRepo = Awaited<ReturnType<typeof getAllUserFarmEvents>>[number]

export const getFarmsService = async (): Promise<FarmData[]> => {
    const farms = await getAllFarmsDapp()
    return farms.map(toFarm)
}

export const getFarmService = async (address: string, chainId: number): Promise<FarmData> => {
    const farm = await getFarmByAddressAndChainId(address, chainId)
    if (
        !farm
        || !farm.isActive
        || !farm.pool.isActive
        || !farm.pool.token0.isActive
        || !farm.pool.token1.isActive
        || !farm.rewardToken.isActive
    ) throw notFound("farm not found")
    return toFarm(farm)
}

export const setFarmService = async (body: FarmBodyDTO): Promise<FarmData> => {
    const { farm } = body

    const existing = await getFarmByAddressAndChainId(farm.address, farm.chainId)
    if (existing) throw conflict("Duplicate farm found")

    const pool = await getActivePoolByAddressAndChainId(farm.poolAddress, farm.chainId)
    const rewardToken = await getActiveTokenByAddressAndChainId(
        farm.rewardTokenAddress,
        farm.chainId,
    )

    const created = await setNewFarm({
        address: farm.address,
        chainId: farm.chainId,
        poolId: pool.id,
        rewardTokenId: rewardToken.id,
        isActive: farm.isActive,
    })

    return toFarm(created)
}

export const getUserPositionsService = async (userId: string): Promise<StakingPosition[]> => {
    const positions = await getAllUserPositions(userId)
    return positions.map(toPosition)
}

export const getUserFarmEventsService = async (userId: string): Promise<StakingEvent[]> => {
    const userEvents = await getAllUserFarmEvents(userId)
    return userEvents.map(toStakingEvent)
}

export const getUserFarmEventService = async (
    userId: string,
    chainId: number,
    txHash: string,
): Promise<StakingEvent> => {
    const event = await getEventChainIdTxHash(userId, chainId, txHash)
    if (!event) throw notFound("event not found")
    return toStakingEvent(event)
}

const toStakingEvent = (event: EventFromRepo): StakingEvent => ({
    amount: event.amount.toString(),
    chainId: event.chainId,
    createdAt: event.createdAt.toISOString(),
    status: event.status,
    txHash: event.txHash ?? null,
    type: event.type,
    farm: toFarm(event.farm),
})

const toFarm = (farm: FarmFromRepo): FarmData => ({
    address: farm.address,
    chainId: farm.chainId,
    isActive: farm.isActive,
    pool: toPool(farm.pool),
    rewardToken: toToken(farm.rewardToken),
})

const toPosition = (position: PositionFromRepo): StakingPosition => ({
    stakedAmount: position.stakedAmount.toString(),
    chainId: position.chainId,
    farm: toFarm(position.farm),
})
