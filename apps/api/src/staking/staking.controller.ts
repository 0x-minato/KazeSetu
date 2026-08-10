import { Request, Response } from "express"
import { sendSuccess } from "../utils/api-response"
import { getAuth } from "../types/authed-request"
import { ChainIdQueryDTO, TxHashParamsDTO } from "../dto/common"
import {
    FarmAddressParamsDTO,
    FarmBodyDTO,
} from "./staking.dto"
import {
    getFarmsService,
    getFarmService,
    getUserFarmEventService,
    getUserFarmEventsService,
    getUserPositionsService,
    setFarmService,
} from "./staking.service"

export const getAllFarms = async (_req: Request, res: Response) => {
    const farms = await getFarmsService()
    sendSuccess(res, farms)
}

export const getFarmByAddressChainId = async (req: Request, res: Response) => {
    const { address } = req.params as FarmAddressParamsDTO
    const { chainId } = req.query as unknown as ChainIdQueryDTO
    const farm = await getFarmService(address, chainId)
    sendSuccess(res, farm)
}

export const setFarm = async (req: Request, res: Response) => {
    const body = req.body as FarmBodyDTO
    const farm = await setFarmService(body)
    sendSuccess(res, farm)
}

export const getUserFarmPositions = async (req: Request, res: Response) => {
    const positions = await getUserPositionsService(getAuth(req).userId)
    sendSuccess(res, positions)
}

export const getUserFarmEvents = async (req: Request, res: Response) => {
    const userEvents = await getUserFarmEventsService(getAuth(req).userId)
    sendSuccess(res, userEvents)
}

export const getUserFarmEvent = async (req: Request, res: Response) => {
    const { txHash } = req.params as TxHashParamsDTO
    const { chainId } = req.query as unknown as ChainIdQueryDTO
    const event = await getUserFarmEventService(getAuth(req).userId, chainId, txHash)
    sendSuccess(res, event)
}
