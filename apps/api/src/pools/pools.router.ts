import { Router } from 'express'
import { authenticateAccessToken, authenticateWorkerOrAdmin, requireAdmin } from '../middlewares/authenticate'
import { getPoolByAddressChainId, getPools, setPool, updatePool } from './pools.controller'
import { validateBody, validateParams, validateQuery } from '../middlewares/validate'
import { chainIdQuerySchema, poolAddressParamsSchema, poolBodySchema, poolStateBodySchema } from './pools.dto'

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
poolRouter.put('/:address',
    authenticateWorkerOrAdmin,
    validateParams(poolAddressParamsSchema),
    validateQuery(chainIdQuerySchema),
    validateBody(poolStateBodySchema),
    updatePool,
)
