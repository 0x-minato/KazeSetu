import { Decimal } from "@prisma/client/runtime/client"
import { getAllSwapsService } from "../swaps/swaps.service"
import { getPoolsTvlService } from "../pools/pools.service"
import { getLiquidityEvents24HrService } from "../liquidity/liquidity.service"

export const getTVLService = async (): Promise<{ totalValueUsd: string }> => {
    const activePools = await getPoolsTvlService()

    let totalValueUsd = new Decimal(0)

    for (const pool of activePools) {
        const price0 = pool.token0.price?.priceUsd ?? new Decimal(0)
        const price1 = pool.token1.price?.priceUsd ?? new Decimal(0)

        const poolTvl = new Decimal(pool.reserve0).mul(price0)
            .add(new Decimal(pool.reserve1).mul(price1))

        totalValueUsd = totalValueUsd.add(poolTvl)
    }

    return {
        totalValueUsd: totalValueUsd.toString(),
    }
}

export const getVolumeService = async (): Promise<{ volumeUsd: string }> => {
    const swaps = await getAllSwapsService()

    let volume = new Decimal(0)

    for (const swap of swaps) {
        const priceTokenIn = swap.tokenIn.price?.priceUsd ?? new Decimal(0)
        const swapVolume = priceTokenIn.mul(swap.amountIn)
        
        volume = volume.add(swapVolume)    
    }

    return {
        volumeUsd: volume.toString()
    }
}

export const getLiquidityService = async (): Promise<{liquidityUsd: string}> => {
    const liquidities = await getLiquidityEvents24HrService()

    let liquidity = new Decimal(0)

    for (const liq of liquidities) {
        const price0 = liq.pool.token0.price?.priceUsd ?? new Decimal(0)         
        const price1 = liq.pool.token1.price?.priceUsd ?? new Decimal(0) 
        
        const amount0 = liq.amount0
        const amount1 = liq.amount1

        const currLiq = price0.mul(amount0).add(price1.mul(amount1))

        liquidity = liquidity.add(currLiq)
    }

    return {
        liquidityUsd: liquidity.toString()
    }
} 

export const getOverviewService = async (): Promise<{
    tvl: string, volume: string, liquidity: string
}> => {
    const [tvl, volume, liquidity] = await Promise.all([
        getTVLService(),
        getVolumeService(),
        getLiquidityService()
    ])

    return {
        tvl: tvl.totalValueUsd,
        volume: volume.volumeUsd,
        liquidity: liquidity.liquidityUsd
    }
}
