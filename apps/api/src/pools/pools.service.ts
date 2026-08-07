import { getActiveTokenByAddressAndChainId } from "../tokens/tokens.service"
import { toToken } from "../tokens/tokens.mapper"
import { conflict, notFound } from "../utils/api-error"
import { PoolBodyDTO } from "./pools.dto"
import { getAllPools, getPoolByAddressAndChainId, setNewPool } from "./pools.repository"
import { Pool } from "./pools.types"

type PoolWithTokens = NonNullable<
  Awaited<ReturnType<typeof getPoolByAddressAndChainId>>
>

export const getPoolsService = async (): Promise<Pool[]> => {
    const pools = await getAllPools()
    return pools.map(toPool)
}

export const getPoolService = async (address: string, chainId: number): Promise<Pool> => {
    const pool = await getPoolByAddressAndChainId(address, chainId)
    if (
        !pool || !pool.isActive || !pool.token0.isActive || !pool.token1.isActive
    ) throw notFound("Pool not found")
    return toPool(pool)
}

export const setPoolService = async (body: PoolBodyDTO): Promise<Pool> => {
    const { pool } = body

    const existing = await getPoolByAddressAndChainId(pool.address, pool.chainId)
    if (existing) throw conflict("Duplicate pool found")

    const token0 = await getActiveTokenByAddressAndChainId(
        pool.token0Address,
        pool.chainId,
    )
    const token1 = await getActiveTokenByAddressAndChainId(
        pool.token1Address,
        pool.chainId,
    )

    const created = await setNewPool({
        address: pool.address,
        chainId: pool.chainId,
        token0Id: token0.id,
        token1Id: token1.id,
        feeBps: pool.feeBps,
        reserve0: pool.reserve0,
        reserve1: pool.reserve1,
        isActive: pool.isActive,
    })

    return toPool(created)
}

const toPool = (pool: PoolWithTokens): Pool => ({
    address: pool.address,
    chainId: pool.chainId,
    feeBps: pool.feeBps,
    reserve0: pool.reserve0.toString(),
    reserve1: pool.reserve1.toString(),
    token0: toToken(pool.token0),
    token1: toToken(pool.token1),
})
