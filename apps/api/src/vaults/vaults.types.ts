import { SwapStatus, VaultEventType } from "../../app/generated/prisma/enums"
import { Pool } from "../pools/pools.types"

export interface VaultData {
    address: string
    chainId: number
    name: string
    symbol: string
    fee: number
    tickLower: number
    tickUpper: number
    currentTick: number
    sqrtPriceX96: string
    tokenId: string
    liquidity: string
    amount0: string
    amount1: string
    totalSupply: string
    tvlUsd: string
    inRange: boolean
    isPaused: boolean
    isActive: boolean
    managerAddress: string
    swapRouterAddress: string
    pool: Pool
}

export interface VaultPositionData {
    chainId: number
    shares: string
    sharePct: string
    amount0: string
    amount1: string
    valueUsd: string
    vault: VaultData
}

export interface VaultEventData {
    chainId: number
    type: VaultEventType
    amount0: string
    amount1: string
    shares: string
    liquidity: string
    oldTickLower: number | null
    oldTickUpper: number | null
    newTickLower: number | null
    newTickUpper: number | null
    txHash: string | null
    status: SwapStatus
    createdAt: string
    vault: VaultData
}
