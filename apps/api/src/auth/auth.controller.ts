import { Request, Response } from "express";
import { generateNonce, verifyAuthentication } from "./auth.service";
import { sendSuccess } from "../utils/api-response";

export const nonceController = (_req: Request, res: Response) => {
    const nonce = generateNonce()
    sendSuccess(res, nonce)
}

export const verifyController = async (req: Request, res: Response) => {
    const { message, signature } = req.body
    const result = await verifyAuthentication({message, signature})
    sendSuccess(res, result)
}