import { Router } from 'express'
import { authenticateAccessToken } from '../middlewares/authenticate'
import { getSwapData, getSwapsData } from './swaps.controller'
import { validateParams, validateQuery } from '../middlewares/validate'
import { chainIdQuerySchema, swapTxHashParamsSchema } from './swaps.dto'

export const swapRouter: Router = Router()

swapRouter.get('/me', authenticateAccessToken, getSwapsData)
swapRouter.get('/:txHash',
    authenticateAccessToken, 
    validateParams(swapTxHashParamsSchema),
    validateQuery(chainIdQuerySchema),
    getSwapData
)

