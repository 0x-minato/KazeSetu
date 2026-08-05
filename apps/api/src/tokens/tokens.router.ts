import { Router } from "express"
import { authenticateAccessToken, requireAdmin } from "../middlewares/authenticate"
import { addSupportedToken, getSupportedToken, getSupportedTokens } from "./tokens.controller"
import { validateBody, validateParams, validateQuery } from "../middlewares/validate"
import { chainIdQuerySchema, tokenAddressParamsSchema, tokenBodySchema } from "./tokens.dto"

export const tokenRouter: Router = Router()

tokenRouter.get('/', authenticateAccessToken, getSupportedTokens)
tokenRouter.get('/:address', 
    authenticateAccessToken, 
    validateQuery(chainIdQuerySchema), 
    validateParams(tokenAddressParamsSchema), 
    getSupportedToken
)
tokenRouter.post('/', 
    authenticateAccessToken,
    requireAdmin, 
    validateBody(tokenBodySchema), 
    addSupportedToken
)