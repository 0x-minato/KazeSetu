import { Request, Response } from "express";
import { badRequest } from "../utils/api-error";
import { getCurrentUser, linkWallet, unlinkWallet } from "./users.service";
import { sendSuccess } from "../utils/api-response";
import { getAuth } from "../types/authed-request";

export const profileController = async (req: Request, res: Response) => {
    const userDetails = await getCurrentUser(getAuth(req).userId)
    sendSuccess(res, userDetails)
}

export const walletController = async (req: Request, res: Response) => {
    const { message, signature } = req.body
    const wallet = await linkWallet(getAuth(req).userId, message, signature)
    sendSuccess(res, wallet)
}

export const unlinkWalletController = async (req: Request, res: Response) => {
    const walletId = req.params.walletId
    if (typeof walletId !== "string" || !walletId) throw badRequest("wallet id is required")
    const {message, signature} = req.body
    await unlinkWallet(getAuth(req).userId, walletId, message, signature)
    sendSuccess(res, true)
}
