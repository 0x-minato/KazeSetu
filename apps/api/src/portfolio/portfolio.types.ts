import { Pool } from "../pools/pools.types";
import { VaultPositionData } from "../vaults/vaults.types";

export interface Position {
    pool: Pool
    valueUsd: string
    amount0: string
    amount1: string
}

export interface Portfolio {
    positions: Position[],
    vaultPositions: VaultPositionData[],
    totalValueUsd: string
}