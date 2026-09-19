import { Request, Response } from "express";
import { getAuth } from "../types/authed-request";
import { sendSuccess } from "../utils/api-response";
import { getLiquidityEventService, getLiquidityEventsService, getLiquidityService } from "./liquidity.service";
import { ChainIdQueryDTO, LiquidityTxHashParamsDTO } from "./liquidity.dto";

export const getLiquidity = async (req: Request, res: Response) => {
    const liquidityData = await getLiquidityService(getAuth(req).address) 
    sendSuccess(res, liquidityData)
}

export const getLiquidityEvents = async (req: Request, res: Response) => {
    const liquidityEventData = await getLiquidityEventsService(getAuth(req).address) 
    sendSuccess(res, liquidityEventData)
}

export const getLiquidityEvent = async (req: Request, res: Response) => {
    const { chainId } = req.query as unknown as ChainIdQueryDTO
    const { txHash } = req.params as LiquidityTxHashParamsDTO 
    const liquidityEventData = await getLiquidityEventService(getAuth(req).address, chainId, txHash) 
    sendSuccess(res, liquidityEventData)
}