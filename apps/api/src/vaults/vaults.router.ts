import { Router } from "express"
import {
    authenticateAccessToken,
    authenticateWorkerOrAdmin,
    requireAdmin,
} from "../middlewares/authenticate"
import { validateBody, validateParams, validateQuery } from "../middlewares/validate"
import {
    createVault,
    getUserVaultEvent,
    getUserVaultEvents,
    getUserVaultPositions,
    getVaultByAddressChainId,
    getVaults,
    updateVaultState,
} from "./vaults.controller"
import {
    chainIdQuerySchema,
    vaultAddressParamsSchema,
    vaultBodySchema,
    vaultStateBodySchema,
    vaultTxHashParamsSchema,
} from "./vaults.dto"

export const vaultRouter: Router = Router()

vaultRouter.get("/", authenticateAccessToken, getVaults)
vaultRouter.get("/me", authenticateAccessToken, getUserVaultPositions)
vaultRouter.get("/events/me", authenticateAccessToken, getUserVaultEvents)
vaultRouter.get(
    "/events/:txHash",
    authenticateAccessToken,
    validateParams(vaultTxHashParamsSchema),
    validateQuery(chainIdQuerySchema),
    getUserVaultEvent,
)
vaultRouter.get(
    "/:address",
    authenticateAccessToken,
    validateParams(vaultAddressParamsSchema),
    validateQuery(chainIdQuerySchema),
    getVaultByAddressChainId,
)
vaultRouter.post(
    "/",
    authenticateAccessToken,
    requireAdmin,
    validateBody(vaultBodySchema),
    createVault,
)
vaultRouter.put(
    "/:address",
    authenticateWorkerOrAdmin,
    validateParams(vaultAddressParamsSchema),
    validateQuery(chainIdQuerySchema),
    validateBody(vaultStateBodySchema),
    updateVaultState,
)
