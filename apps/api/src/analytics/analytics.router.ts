import { Router } from 'express'
import { authenticateAccessToken } from '../middlewares/authenticate'
import { getTvl, getVolume, getLiquidity, getOverview } from './analytics.controller'

export const analyticsRouter: Router = Router()

analyticsRouter.get('/tvl', authenticateAccessToken, getTvl)
analyticsRouter.get('/volume', authenticateAccessToken, getVolume)
analyticsRouter.get('/liquidity', authenticateAccessToken, getLiquidity)
analyticsRouter.get('/overview', authenticateAccessToken, getOverview)