import { Prisma } from "../../app/generated/prisma/client.js"
import { getActiveTokenByAddressAndChainId } from "../tokens/tokens.service"
import { conflict, notFound } from "../utils/api-error"
import { PoolBodyDTO, PoolStateBodyDTO } from "./pools.dto"
import { getAllPools, getAllPoolsForTvl, getPoolByAddressAndChainId, setNewPool, updatePoolState } from "./pools.repository"
import { Pool } from "./pools.types"
import { toPool } from "./pools.mapper"

type PoolSides = {
    token0Address: string
    token1Address: string
    reserve0: string
    reserve1: string
}

export const canonicalizePoolSides = <T extends PoolSides>(pool: T): T => {
    if (pool.token0Address < pool.token1Address) return pool
    return {
        ...pool,
        token0Address: pool.token1Address,
        token1Address: pool.token0Address,
        reserve0: pool.reserve1,
        reserve1: pool.reserve0,
    }
}

export const getPoolsService = async (): Promise<Pool[]> => {
    const pools = await getAllPools()
    return pools.map(toPool)
}

export const getPoolsTvlService = async () => {
    const pools = await getAllPoolsForTvl()
    return pools
} 

export const getActivePoolByAddressAndChainId = async (address: string, chainId: number) => {
    const pool = await getPoolByAddressAndChainId(address, chainId)
    if (
        !pool || !pool.isActive || !pool.token0.isActive || !pool.token1.isActive
    ) throw notFound("Pool not found")
    return {
        id: pool.id,
        ...toPool(pool),
    }
}

export const getPoolService = async (address: string, chainId: number): Promise<Pool> => {
    const { id: _id, ...pool } = await getActivePoolByAddressAndChainId(address, chainId)
    return pool
}

export const setPoolService = async (body: PoolBodyDTO): Promise<Pool> => {
    const pool = canonicalizePoolSides(body.pool)

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

    try {
        const created = await setNewPool({
            address: pool.address,
            chainId: pool.chainId,
            token0Id: token0.id,
            token1Id: token1.id,
            feeBps: pool.feeBps,
            totalSupply: pool.totalSupply,
            reserve0: pool.reserve0,
            reserve1: pool.reserve1,
            isActive: pool.isActive,
        })
        return toPool(created)
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            throw conflict("Duplicate pool found")
        }
        throw error
    }
}

export const updatePoolService = async (
    address: string,
    chainId: number,
    body: PoolStateBodyDTO,
): Promise<Pool> => {
    const existing = await getPoolByAddressAndChainId(address, chainId)
    if (!existing) throw notFound("Pool not found")

    const updated = await updatePoolState({
        address,
        chainId,
        totalSupply: body.totalSupply,
        reserve0: body.reserve0,
        reserve1: body.reserve1,
        isActive: body.isActive,
    })

    return toPool(updated)
}
