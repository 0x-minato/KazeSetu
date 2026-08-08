import { Request, Response } from "express";
import { getAuth } from "../types/authed-request";
import { sendSuccess } from "../utils/api-response";
import { getSwapService, getSwapsService } from "./swaps.service";
import { ChainIdQueryDTO, SwapTxHashParamsDTO } from "./swaps.dto";

export const getSwapsData = async (req: Request, res: Response) => {
    const swapsData = await getSwapsService(getAuth(req).userId)
    sendSuccess(res, swapsData)
}

export const getSwapData = async (req: Request, res: Response) => {
    const { txHash } = req.params as SwapTxHashParamsDTO
    const { chainId } = req.query as unknown as ChainIdQueryDTO
    const swapData = await getSwapService(getAuth(req).userId, txHash, chainId)
    sendSuccess(res, swapData)
}