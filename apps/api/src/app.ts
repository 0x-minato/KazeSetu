import express, { Express } from 'express'
import { authRouter } from './auth/auth.router'
import { errorHandler } from './middlewares/error-handler.js'

export const app: Express = express()  

app.use(express.json())

app.get('/health', (req, res) => {
    res.json({
        status: "ok",
        bool: true
    })
})

app.use('/api/auth', authRouter)

app.use(errorHandler)