import { Router } from "express";
import { nonceController, verifyController } from "./auth.controller";
import { verifyAuthSchema } from "./auth.dto";
import { validate } from "../middlewares/validate";

export const authRouter: Router = Router()

authRouter.get('/nonce', nonceController)
authRouter.get('/verify', validate(verifyAuthSchema), verifyController)