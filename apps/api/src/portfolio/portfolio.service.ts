import { Decimal } from "@prisma/client/runtime/client"
import { getLiquidityService } from "../liquidity/liquidity.service"
import { Pool } from "../pools/pools.types"
import { getPriceUsdOrZero } from "../prices/prices.service"
import { getUserPositionsService } from "../staking/staking.service"
import { internalServerError } from "../utils/api-error"
import { Portfolio } from "./portfolio.types"

const poolKey = (pool: Pool) => `${pool.chainId}:${pool.address.toLowerCase()}`

export const getUserPortfolio = async (address: string): Promise<Portfolio> => {
    const priceByToken = new Map<string, Decimal>()
    const tokenKey = (tokenAddress: string, chainId: number) =>
    `${chainId}:${tokenAddress.toLowerCase()}`
    const priceUsd = async (tokenAddress: string, chainId: number) => {
        const key = tokenKey(tokenAddress, chainId)
        const cached = priceByToken.get(key)
        if (cached) return cached
        const price = await getPriceUsdOrZero(tokenAddress, chainId)
        priceByToken.set(key, price)
        return price
    }

    const [liquidityData, stakingData] = await Promise.all([
        getLiquidityService(address),
        getUserPositionsService(address),
    ])

    const lpByPool = new Map<string, { pool: Pool, lpTokenAmount: Decimal }>()
    const addLp = (pool: Pool, amount: string) => {
        const key = poolKey(pool)
        const existing = lpByPool.get(key)
        if (existing) {
            existing.lpTokenAmount = existing.lpTokenAmount.add(amount)
            return
        }
        lpByPool.set(key, {
            pool,
            lpTokenAmount: new Decimal(amount),
        })
    }

    for (const liquidity of liquidityData) {
        addLp(liquidity.pool, liquidity.lpTokenAmount)
    }
    for (const position of stakingData) {
        addLp(position.farm.pool, position.stakedAmount)
    }

    const portfolio: Portfolio = {
        positions: [],
        totalValueUsd: "0",
    }
    let totalValue = new Decimal(0)

    for (const { pool, lpTokenAmount } of lpByPool.values()) {
        const supply = new Decimal(pool.totalSupply)
        if (supply.equals(0)) {
            throw internalServerError("Pool total supply is zero", {
                address: pool.address,
                chainId: pool.chainId,
            })
        }
        const amount0 = lpTokenAmount.div(supply).mul(pool.reserve0)
        const amount1 = lpTokenAmount.div(supply).mul(pool.reserve1)
        const [price0Usd, price1Usd] = await Promise.all([
            priceUsd(pool.token0.address, pool.chainId),
            priceUsd(pool.token1.address, pool.chainId),
        ])
        const valueUsd = amount0.mul(price0Usd).add(amount1.mul(price1Usd))
        portfolio.positions.push({
            pool,
            valueUsd: valueUsd.toString(),
            amount0: amount0.toString(),
            amount1: amount1.toString(),
        })
        totalValue = totalValue.add(valueUsd)
    }

    portfolio.totalValueUsd = totalValue.toString()
    return portfolio
}
