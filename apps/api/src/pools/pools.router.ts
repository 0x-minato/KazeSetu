import { Router } from 'express'
import { authenticateAccessToken, requireAdmin } from '../middlewares/authenticate'
import { getPoolByAddressChainId, getPools, setPool } from './pools.controller'
import { validateBody, validateParams, validateQuery } from '../middlewares/validate'
import { chainIdQuerySchema, poolAddressParamsSchema, poolBodySchema } from './pools.dto'

export const poolRouter: Router = Router()

poolRouter.get('/', authenticateAccessToken, getPools)
poolRouter.get('/:address', 
    authenticateAccessToken,
    validateParams(poolAddressParamsSchema), 
    validateQuery(chainIdQuerySchema),
    getPoolByAddressChainId
)
poolRouter.post('/', 
    authenticateAccessToken,
    requireAdmin,
    validateBody(poolBodySchema),
    setPool 
)