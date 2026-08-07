import { Request, Response } from "express";
import { getPoolService, getPoolsService, setPoolService } from "./pools.service";
import { sendSuccess } from "../utils/api-response";
import { ChainIdQueryDTO, PoolAddressParamsDTO, PoolBodyDTO } from "./pools.dto";

export const getPools = async (_req: Request, res: Response) => {
    const pools = await getPoolsService()
    sendSuccess(res, pools)
}

export const getPoolByAddressChainId = async (req: Request, res: Response) => {
    const { address } = req.params as PoolAddressParamsDTO
    const { chainId } = req.query as unknown as ChainIdQueryDTO
    const pool = await getPoolService(address, chainId)
    sendSuccess(res, pool)
}

export const setPool = async (req: Request, res: Response) => {
    const body = req.body as PoolBodyDTO
    const pool = await setPoolService(body)
    sendSuccess(res, pool)
}
