import { SwapStatus } from "../../app/generated/prisma/enums"
import { Pool } from "../pools/pools.types"
import { Token } from "../tokens/tokens.types"

export interface SwapData {
    chainId: number,
    status: SwapStatus,
    txHash: string | null,
    amountIn: string,
    amountOut: string,
    createdAt: string 
    pool: Pool,
    tokenIn: Token,
    tokenOut: Token
}