import { toPool } from "../pools/pools.mapper"
import { notFound } from "../utils/api-error"
import { getAllLiquidityEventsSuccess, getLiquidityByAddress, getLiquidityEventByAddress, getLiquidityEventByAddressChainIdHash } from "./liquidity.repository"
import { Liquidity, LiquidityEvent } from "./liquidity.types"

type LiquidityFromRepo = Awaited<ReturnType<typeof getLiquidityByAddress>>[number]
type LiquidityEventFromRepo = Awaited<ReturnType<typeof getLiquidityEventByAddress>>[number]

export const getLiquidityService = async (address: string): Promise<Liquidity[]> => {
    const liquidity = await getLiquidityByAddress(address) 
    return liquidity.map(toLiquidity)
}

export const getLiquidityEventsService = async (address: string): Promise<LiquidityEvent[]> => {
    const liquidity = await getLiquidityEventByAddress(address) 
    return liquidity.map(toLiquidityEvent)
}

export const getLiquidityEvents24HrService = async () => {
    const liquidities = await getAllLiquidityEventsSuccess()
    return liquidities
} 

export const getLiquidityEventService = async (
    address: string,
    chainId: number,
    txHash: string
): Promise<LiquidityEvent> => {
    const liquidity = await getLiquidityEventByAddressChainIdHash(
        address, chainId, txHash
    )
    if (!liquidity) throw notFound("liquidity event not found")
    return toLiquidityEvent(liquidity)
}

const toLiquidity = (liq: LiquidityFromRepo):Liquidity => ({
    chainId: liq.chainId,
    lpTokenAmount: liq.lpTokenAmount.toString(),
    pool: toPool(liq.pool)    
})

const toLiquidityEvent = (liq: LiquidityEventFromRepo):LiquidityEvent => ({
    chainId: liq.chainId,
    type: liq.type,
    amount0: liq.amount0.toString(),
    amount1: liq.amount1.toString(),
    lpAmount: liq.lpAmount.toString(),
    txHash: liq.txHash ?? null,
    status: liq.status,
    pool: toPool(liq.pool),
    createdAt: liq.createdAt.toISOString()
})