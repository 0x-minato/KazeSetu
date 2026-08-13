import { Request, Response } from "express"
import { sendSuccess } from "../utils/api-response"
import { getTVLService, getVolumeService, getLiquidityService, getOverviewService } from "./analytics.service"

export const getTvl = async (_req: Request, res: Response) => {
    const tvl = await getTVLService()
    sendSuccess(res, tvl)
}

export const getVolume = async (_req: Request, res: Response) => {
    const volume = await getVolumeService()
    sendSuccess(res, volume)
}

export const getLiquidity = async (_req: Request, res: Response) => {
    const liquidity = await getLiquidityService()
    sendSuccess(res, liquidity)
}

export const getOverview = async (_req: Request, res: Response) => {
    const overview = await getOverviewService()
    sendSuccess(res, overview)
}
