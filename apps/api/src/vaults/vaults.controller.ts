import { Request, Response } from "express"
import { getAuth } from "../types/authed-request"
import { sendSuccess } from "../utils/api-response"
import {
    ChainIdQueryDTO,
    VaultAddressParamsDTO,
    VaultBodyDTO,
    VaultStateBodyDTO,
    VaultTxHashParamsDTO,
} from "./vaults.dto"
import {
    createVaultService,
    getUserVaultEventService,
    getUserVaultEventsService,
    getUserVaultPositionsService,
    getVaultService,
    getVaultsService,
    updateVaultStateService,
} from "./vaults.service"

export const getVaults = async (_req: Request, res: Response) => {
    const vaults = await getVaultsService()
    sendSuccess(res, vaults)
}

export const getVaultByAddressChainId = async (req: Request, res: Response) => {
    const { address } = req.params as VaultAddressParamsDTO
    const { chainId } = req.query as unknown as ChainIdQueryDTO
    const vault = await getVaultService(address, chainId)
    sendSuccess(res, vault)
}

export const getUserVaultPositions = async (req: Request, res: Response) => {
    const positions = await getUserVaultPositionsService(getAuth(req).address)
    sendSuccess(res, positions)
}

export const getUserVaultEvents = async (req: Request, res: Response) => {
    const events = await getUserVaultEventsService(getAuth(req).address)
    sendSuccess(res, events)
}

export const getUserVaultEvent = async (req: Request, res: Response) => {
    const { txHash } = req.params as VaultTxHashParamsDTO
    const { chainId } = req.query as unknown as ChainIdQueryDTO
    const event = await getUserVaultEventService(getAuth(req).address, chainId, txHash)
    sendSuccess(res, event)
}

export const createVault = async (req: Request, res: Response) => {
    const body = req.body as VaultBodyDTO
    const vault = await createVaultService(body)
    sendSuccess(res, vault, 201)
}

export const updateVaultState = async (req: Request, res: Response) => {
    const { address } = req.params as VaultAddressParamsDTO
    const { chainId } = req.query as unknown as ChainIdQueryDTO
    const body = req.body as VaultStateBodyDTO
    const vault = await updateVaultStateService(address, chainId, body)
    sendSuccess(res, vault)
}
