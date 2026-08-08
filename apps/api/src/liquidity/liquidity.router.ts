import { Router } from 'express'
import { authenticateAccessToken } from '../middlewares/authenticate'
import { getLiquidity, getLiquidityEvent, getLiquidityEvents } from './liquidity.controller'
import { validateParams, validateQuery } from '../middlewares/validate'
import { chainIdQuerySchema, liquidityTxHashParamsSchema } from './liquidity.dto'

export const liquidityRouter: Router = Router()

liquidityRouter.get('/me', authenticateAccessToken, getLiquidity)
liquidityRouter.get('/events/me', authenticateAccessToken, getLiquidityEvents)
liquidityRouter.get('/events/:txHash', 
    authenticateAccessToken,
    validateParams(liquidityTxHashParamsSchema),
    validateQuery(chainIdQuerySchema),
    getLiquidityEvent
)