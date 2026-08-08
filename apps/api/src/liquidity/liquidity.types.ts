import { LiquidityEventType, SwapStatus } from "../../app/generated/prisma/enums";
import { Pool } from "../pools/pools.types";

export interface Liquidity {
    chainId: number,
    lpTokenAmount: string,
    pool: Pool
}

export interface LiquidityEvent {
    chainId: number, 
    type: LiquidityEventType,
    amount0: string,
    amount1: string,
    lpAmount: string,
    txHash: string | null
    status: SwapStatus
    pool: Pool
    createdAt: string
}