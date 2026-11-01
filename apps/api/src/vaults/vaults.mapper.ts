import { toPool } from "../pools/pools.mapper"
import {
    getUserVaultEvents,
    getUserVaultPositions,
    getVaultByAddressAndChainId,
} from "./vaults.repository"
import { VaultData, VaultEventData, VaultPositionData } from "./vaults.types"

export type VaultFromRepo = NonNullable<
    Awaited<ReturnType<typeof getVaultByAddressAndChainId>>
>
export type VaultPositionFromRepo = Awaited<
    ReturnType<typeof getUserVaultPositions>
>[number]
export type VaultEventFromRepo = Awaited<
    ReturnType<typeof getUserVaultEvents>
>[number]

export const toVaultData = (vault: VaultFromRepo, tvlUsd: string): VaultData => ({
    address: vault.address,
    chainId: vault.chainId,
    name: vault.name,
    symbol: vault.symbol,
    fee: vault.fee,
    tickLower: vault.tickLower,
    tickUpper: vault.tickUpper,
    currentTick: vault.currentTick,
    sqrtPriceX96: vault.sqrtPriceX96,
    tokenId: vault.tokenId,
    liquidity: vault.liquidity.toString(),
    amount0: vault.amount0.toString(),
    amount1: vault.amount1.toString(),
    totalSupply: vault.totalSupply.toString(),
    tvlUsd,
    inRange: vault.currentTick >= vault.tickLower && vault.currentTick < vault.tickUpper,
    isPaused: vault.isPaused,
    isActive: vault.isActive,
    managerAddress: vault.managerAddress,
    swapRouterAddress: vault.swapRouterAddress,
    pool: toPool(vault.pool),
})

export const toVaultPositionData = (
    position: VaultPositionFromRepo,
    computed: {
        sharePct: string
        amount0: string
        amount1: string
        valueUsd: string
        vault: VaultData
    },
): VaultPositionData => ({
    chainId: position.chainId,
    shares: position.shares.toString(),
    sharePct: computed.sharePct,
    amount0: computed.amount0,
    amount1: computed.amount1,
    valueUsd: computed.valueUsd,
    vault: computed.vault,
})

export const toVaultEventData = (
    event: VaultEventFromRepo,
    vaultData: VaultData,
): VaultEventData => ({
    chainId: event.chainId,
    type: event.type,
    amount0: event.amount0.toString(),
    amount1: event.amount1.toString(),
    shares: event.shares.toString(),
    liquidity: event.liquidity.toString(),
    oldTickLower: event.oldTickLower ?? null,
    oldTickUpper: event.oldTickUpper ?? null,
    newTickLower: event.newTickLower ?? null,
    newTickUpper: event.newTickUpper ?? null,
    txHash: event.txHash ?? null,
    status: event.status,
    createdAt: event.createdAt.toISOString(),
    vault: vaultData,
})
