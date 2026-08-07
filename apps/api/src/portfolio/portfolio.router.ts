import { Router } from 'express'
import { authenticateAccessToken } from '../middlewares/authenticate'
import { getPortfolio } from './portfolio.controller'

export const portfolioRouter: Router = Router()

portfolioRouter.get('/me', authenticateAccessToken, getPortfolio)