import { Decimal } from "@prisma/client/runtime/client"
import { Portfolio} from "./portfolio.types"
import { getLiquidityService } from "../liquidity/liquidity.service"
import { getPriceUsdOrZero } from "../prices/prices.service"
import { internalServerError } from "../utils/api-error"

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
    // get all liquidity positions for wallet id 
    const liquidityData =  await getLiquidityService(address)
    let portfolio: Portfolio =  {
        positions: [],
        totalValueUsd: '0'
    }
    let totalValue = new Decimal(0)
    // for each liquidity position get pool data for that pool 
    for (const liquidity of liquidityData) {
        // use reserves and totalSupply to calc amount0 and amount1
        const lp = new Decimal(liquidity.lpTokenAmount)
        const supply = new Decimal(liquidity.pool.totalSupply)
        if (supply.equals(0)) { 
            throw internalServerError("Pool total supply is zero", {
                address: liquidity.pool.address,
                chainId: liquidity.pool.chainId,
            })
        }
        const amount0 = lp.div(supply).mul(liquidity.pool.reserve0)
        const amount1 = lp.div(supply).mul(liquidity.pool.reserve1)
        // get prices
        const [price0Usd, price1Usd] = await Promise.all([
            priceUsd(liquidity.pool.token0.address, liquidity.pool.chainId),
            priceUsd(liquidity.pool.token1.address, liquidity.pool.chainId)
        ])
        const valueUsd = amount0.mul(price0Usd).add(amount1.mul(price1Usd))
        portfolio.positions.push({
            pool: liquidity.pool,
            valueUsd: valueUsd.toString(),
            amount0: amount0.toString(),
            amount1: amount1.toString()
        })
        totalValue = totalValue.add(valueUsd)
    }
    portfolio.totalValueUsd = totalValue.toString()
    // return the portfolio object 
    return portfolio
}