import express, { Express } from 'express'
import { authRouter } from './auth/auth.router'
import { errorHandler } from './middlewares/error-handler.js'
import cookieParser from "cookie-parser"
import cors, { type CorsOptions } from "cors"
import { CORS_ORIGIN } from "./config/env"
import { API_ROUTES } from "./config/routes"
import { globalRateLimiter } from './middlewares/rate-limit.js'
import { userRouter } from './users/users.routes.js'
import { tokenRouter } from './tokens/tokens.router.js'
import { priceRouter } from './prices/prices.router.js'
import { portfolioRouter } from './portfolio/portfolio.router.js'
import { poolRouter } from './pools/pools.router.js'
import { swapRouter } from './swaps/swaps.router.js'
import { liquidityRouter } from './liquidity/liquidity.router.js'
import { stakingRouter } from './staking/staking.router.js'
import { analyticsRouter } from './analytics/analytics.router.js'

export const app: Express = express()  

const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        callback(null, !origin || origin === CORS_ORIGIN)
    },
    credentials: true
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => {
    res.json({
        status: "ok",
        bool: true
    })
})

app.use(API_ROUTES.global, globalRateLimiter)

app.use(API_ROUTES.auth, authRouter)
app.use(API_ROUTES.users, userRouter)
app.use(API_ROUTES.tokens, tokenRouter)
app.use(API_ROUTES.prices, priceRouter)
app.use(API_ROUTES.portfolio, portfolioRouter)
app.use(API_ROUTES.pools, poolRouter)
app.use(API_ROUTES.swaps, swapRouter)
app.use(API_ROUTES.liquidity, liquidityRouter)
app.use(API_ROUTES.staking, stakingRouter)
app.use(API_ROUTES.analytics, analyticsRouter)

app.use(errorHandler)