import { StakingEventType, SwapStatus } from "../../app/generated/prisma/enums";
import { Pool } from "../pools/pools.types";
import { Token } from "../tokens/tokens.types";

export interface FarmData {
    address: string,
    chainId: number,
    isActive: boolean,
    pool: Pool,
    rewardToken: Token,
}

export interface StakingPosition {
    stakedAmount: string,
    chainId: number
    farm: FarmData
}

export interface StakingEvent {
    chainId: number,
    type: StakingEventType,
    amount: string
    txHash: string | null
    status: SwapStatus,
    createdAt: string,
    farm: FarmData
}