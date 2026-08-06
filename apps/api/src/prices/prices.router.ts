import { Router } from 'express'
import { getPriceForSupportedToken, getPricesForSupportedTokens, updatePriceForSupportedToken } from './prices.controller'
import { authenticateAccessToken, requireAdmin } from '../middlewares/authenticate'
import { validateBody, validateParams, validateQuery } from '../middlewares/validate'
import { chainIdQuerySchema, tokenAddressParamsSchema } from '../tokens/tokens.dto'
import { verifyPriceSchema } from './prices.dto'

export const priceRouter: Router = Router()

priceRouter.get('/', authenticateAccessToken, getPricesForSupportedTokens)
priceRouter.get('/:address', 
    authenticateAccessToken, 
    validateQuery(chainIdQuerySchema), 
    validateParams(tokenAddressParamsSchema), 
    getPriceForSupportedToken
)
priceRouter.put('/:address',
    authenticateAccessToken,
    requireAdmin,
    validateQuery(chainIdQuerySchema), 
    validateParams(tokenAddressParamsSchema),
    validateBody(verifyPriceSchema),
    updatePriceForSupportedToken
)