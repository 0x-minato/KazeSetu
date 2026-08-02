import { Router } from "express";
import { logoutController, nonceController, refreshController, verifyController } from "./auth.controller";
import { verifyAuthSchema } from "./auth.dto";
import { validate } from "../middlewares/validate";

export const authRouter: Router = Router()

authRouter.post('/nonce', nonceController)
authRouter.post('/verify', validate(verifyAuthSchema), verifyController)
authRouter.post('/refresh', refreshController)
authRouter.post('/logout', logoutController)
