import express, { Express } from 'express'
import { authRouter } from './auth/auth.router'
import { errorHandler } from './middlewares/error-handler.js'
import cookieParser from "cookie-parser"
import cors, { type CorsOptions } from "cors"
import { CORS_ORIGIN } from "./config/env"
import { userRouter } from './users/users.routes.js'
import { tokenRouter } from './tokens/tokens.router.js'

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

app.get('/health', (req, res) => {
    res.json({
        status: "ok",
        bool: true
    })
})

app.use('/api/auth', authRouter)
app.use('/api/users', userRouter)
app.use('/api/tokens', tokenRouter)

app.use(errorHandler)