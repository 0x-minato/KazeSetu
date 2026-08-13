import { getAllSwaps24Hr, getSwapByUserIdHashChainId, getSwapsByUserId } from "./swaps.repository"
import { SwapData } from "./swaps.types"
import { toToken } from "../tokens/tokens.mapper"
import { toPool } from "../pools/pools.mapper"
import { notFound } from "../utils/api-error"

type SwapFromRepo = Awaited<ReturnType<typeof getSwapsByUserId>>[number]

export const getSwapsService = async (userId: string): Promise<SwapData[]> => {
   const swaps = await getSwapsByUserId(userId)
   return swaps.map(toSwap)
}

export const getAllSwapsService = async () => {
    const swaps = await getAllSwaps24Hr()
    return swaps
}

export const getSwapService = async (
    userId: string, 
    txHash: string, 
    chainId: number
): Promise<SwapData> => {
    const swapData = await getSwapByUserIdHashChainId(userId, chainId, txHash)
    if (!swapData) throw notFound("swap data not found")
    return toSwap(swapData)
}

const toSwap = (swap: SwapFromRepo): SwapData => ({
    chainId: swap.chainId,
    amountIn: swap.amountIn.toString(),
    amountOut: swap.amountOut.toString(),
    createdAt: swap.createdAt.toISOString(),
    status: swap.status,
    txHash: swap.txHash ?? null,
    pool: toPool(swap.pool),
    tokenIn: toToken(swap.tokenIn),
    tokenOut: toToken(swap.tokenOut)
})