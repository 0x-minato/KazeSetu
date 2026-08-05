import { Router } from "express";
import { logoutController, nonceController, refreshController, verifyController } from "./auth.controller";
import { verifyAuthSchema } from "./auth.dto";
import { validateBody } from "../middlewares/validate";
import {
  nonceRateLimiter,
  refreshRateLimiter,
  verifyRateLimiter,
} from "../middlewares/rate-limit";

export const authRouter: Router = Router()

authRouter.post('/nonce', nonceRateLimiter, nonceController)
authRouter.post('/verify', verifyRateLimiter, validateBody(verifyAuthSchema), verifyController)
authRouter.post('/refresh', refreshRateLimiter, validateBody(verifyAuthSchema), refreshController)
authRouter.post('/logout', logoutController)
