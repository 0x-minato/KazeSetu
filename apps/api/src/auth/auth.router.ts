import { Router } from "express";
import { logoutController, nonceController, refreshController, verifyController } from "./auth.controller";
import { verifyAuthSchema } from "./auth.dto";
import { validate } from "../middlewares/validate";
import {
  nonceRateLimiter,
  refreshRateLimiter,
  verifyRateLimiter,
} from "../middlewares/rate-limit";

export const authRouter: Router = Router()

authRouter.post('/nonce', nonceRateLimiter, nonceController)
authRouter.post('/verify', verifyRateLimiter, validate(verifyAuthSchema), verifyController)
authRouter.post('/refresh', refreshRateLimiter, refreshController)
authRouter.post('/logout', logoutController)
