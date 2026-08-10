import { Router } from "express"
import { authenticateAccessToken, requireAdmin } from "../middlewares/authenticate"
import { validateBody, validateParams, validateQuery } from "../middlewares/validate"
import {
    chainIdQuerySchema,
    farmAddressParamsSchema,
    farmBodySchema,
    stakingTxHashParamsSchema,
} from "./staking.dto"
import {
    getAllFarms,
    getFarmByAddressChainId,
    getUserFarmEvent,
    getUserFarmEvents,
    getUserFarmPositions,
    setFarm,
} from "./staking.controller"

export const stakingRouter: Router = Router()

stakingRouter.get("/", authenticateAccessToken, getAllFarms)
stakingRouter.get("/me", authenticateAccessToken, getUserFarmPositions)
stakingRouter.get("/events/me", authenticateAccessToken, getUserFarmEvents)
stakingRouter.get(
    "/events/:txHash",
    authenticateAccessToken,
    validateParams(stakingTxHashParamsSchema),
    validateQuery(chainIdQuerySchema),
    getUserFarmEvent,
)
stakingRouter.get(
    "/:address",
    authenticateAccessToken,
    validateParams(farmAddressParamsSchema),
    validateQuery(chainIdQuerySchema),
    getFarmByAddressChainId,
)
stakingRouter.post(
    "/",
    authenticateAccessToken,
    requireAdmin,
    validateBody(farmBodySchema),
    setFarm,
)
