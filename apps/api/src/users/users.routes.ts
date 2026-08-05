import { Router } from "express"
import { authenticateAccessToken } from "../middlewares/authenticate"
import { profileController, unlinkWalletController, walletController } from "./users.controller"
import { validateBody } from "../middlewares/validate"
import { verifyAuthSchema } from "../auth/auth.dto"

export const userRouter: Router = Router()

userRouter.get('/me', authenticateAccessToken, profileController)
userRouter.post('/me/wallets', authenticateAccessToken, validateBody(verifyAuthSchema), walletController)
userRouter.delete('/me/wallets/:walletId', authenticateAccessToken, validateBody(verifyAuthSchema), unlinkWalletController)

