import { Decimal } from "@prisma/client/runtime/client"
import { LiquidityEventType, VaultEventType } from "../../app/generated/prisma/enums"
import { getAllSwapsService } from "../swaps/swaps.service"
import { getPoolsTvlService } from "../pools/pools.service"
import { getLiquidityEvents24HrService } from "../liquidity/liquidity.service"
import { getVaultEvents24HrService, getVaultsService } from "../vaults/vaults.service"

export const getTVLService = async (): Promise<{ totalValueUsd: string }> => {
    const [activePools, activeVaults] = await Promise.all([
        getPoolsTvlService(),
        getVaultsService(),
    ])

    let totalValueUsd = new Decimal(0)

    for (const pool of activePools) {
        const price0 = pool.token0.price?.priceUsd ?? new Decimal(0)
        const price1 = pool.token1.price?.priceUsd ?? new Decimal(0)

        const poolTvl = new Decimal(pool.reserve0).mul(price0)
            .add(new Decimal(pool.reserve1).mul(price1))

        totalValueUsd = totalValueUsd.add(poolTvl)
    }

    for (const vault of activeVaults) {
        totalValueUsd = totalValueUsd.add(new Decimal(vault.tvlUsd))
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
    const [liquidities, vaultEvents] = await Promise.all([
        getLiquidityEvents24HrService(),
        getVaultEvents24HrService(),
    ])

    let liquidity = new Decimal(0)

    for (const liq of liquidities) {
        const price0 = liq.pool.token0.price?.priceUsd ?? new Decimal(0)         
        const price1 = liq.pool.token1.price?.priceUsd ?? new Decimal(0) 
        
        const amount0 = liq.amount0
        const amount1 = liq.amount1
        const signedValue = price0.mul(amount0).add(price1.mul(amount1))
        const currLiq =
          liq.type === LiquidityEventType.REMOVE
            ? signedValue.neg()
            : signedValue

        liquidity = liquidity.add(currLiq)
    }

    for (const ev of vaultEvents) {
        const price0 = ev.vault.pool.token0.price?.priceUsd ?? new Decimal(0)
        const price1 = ev.vault.pool.token1.price?.priceUsd ?? new Decimal(0)
        const signedValue = price0.mul(ev.amount0).add(price1.mul(ev.amount1))
        const currLiq =
          ev.type === VaultEventType.WITHDRAW
            ? signedValue.neg()
            : signedValue

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
