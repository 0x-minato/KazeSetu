import { Request, Response } from "express";
import { badRequest, unauthorized } from "../utils/api-error";
import { getCurrentUser, linkWallet, unlinkWallet } from "./users.service";
import { sendSuccess } from "../utils/api-response";

export const profileController = async (req: Request, res: Response) => {
    if (!req.auth?.userId) throw unauthorized("Unauthorized")
    const userDetails = await getCurrentUser(req.auth.userId)
    sendSuccess(res, userDetails)
}

export const walletController = async (req: Request, res: Response) => {
    if (!req.auth?.userId) throw unauthorized("Unauthorized")
    const { message, signature } = req.body
    const wallet = await linkWallet(req.auth.userId, message, signature)
    sendSuccess(res, wallet)
}

export const unlinkWalletController = async (req: Request, res: Response) => {
    if (!req.auth?.userId) throw unauthorized("Unauthorized")
    const walletId = req.params.walletId
    if (typeof walletId !== "string" || !walletId) throw badRequest("wallet id is required")
    const {message, signature} = req.body
    await unlinkWallet(req.auth.userId, walletId, message, signature)
    sendSuccess(res, true)
}