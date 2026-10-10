import { Request, Response } from "express";
import { getPoolService, getPoolsService, setPoolService, updatePoolService } from "./pools.service";
import { sendSuccess } from "../utils/api-response";
import { ChainIdQueryDTO, PoolAddressParamsDTO, PoolBodyDTO, PoolStateBodyDTO } from "./pools.dto";

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

export const updatePool = async (req: Request, res: Response) => {
    const { address } = req.params as PoolAddressParamsDTO
    const { chainId } = req.query as unknown as ChainIdQueryDTO
    const body = req.body as PoolStateBodyDTO
    const pool = await updatePoolService(address, chainId, body)
    sendSuccess(res, pool)
}
