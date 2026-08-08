import { toToken } from "../tokens/tokens.mapper"
import { getPoolByAddressAndChainId } from "./pools.repository"
import { Pool } from "./pools.types"

type PoolWithTokens = NonNullable<
  Awaited<ReturnType<typeof getPoolByAddressAndChainId>>
>

export const toPool = (pool: PoolWithTokens): Pool => ({
    address: pool.address,
    chainId: pool.chainId,
    feeBps: pool.feeBps,
    reserve0: pool.reserve0.toString(),
    reserve1: pool.reserve1.toString(),
    token0: toToken(pool.token0),
    token1: toToken(pool.token1),
})