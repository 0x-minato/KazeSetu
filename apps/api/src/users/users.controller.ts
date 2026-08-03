import { Request, Response } from "express";
import { unauthorized } from "../utils/api-error";
import { getCurrentUser, setWallet } from "./users.service";
import { sendSuccess } from "../utils/api-response";

export const profileController = async (req: Request, res: Response) => {
    if (!req.auth?.userId) throw unauthorized("Unauthorized")
    const userDetails = await getCurrentUser(req.auth.userId)
    sendSuccess(res, userDetails)
}

export const walletController = async (req: Request, res: Response) => {
    if (!req.auth?.userId) throw unauthorized("Unauthorized")
    const { message, signature } = req.body
    const wallet = await setWallet(req.auth.userId, message, signature)
    sendSuccess(res, wallet)
}