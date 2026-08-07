import { Request, Response } from "express";
import { unauthorized } from "../utils/api-error";
import { getUserPortfolio } from "./portfolio.service";
import { sendSuccess } from "../utils/api-response";

export const getPortfolio = async (req: Request, res: Response) => {
    if (!req.auth?.userId) throw unauthorized("Unauthorized")
    const userPortfolio = await getUserPortfolio(req.auth.userId)
    sendSuccess(res, userPortfolio)
}