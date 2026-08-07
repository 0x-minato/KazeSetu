import { Request, Response } from "express";
import { getUserPortfolio } from "./portfolio.service";
import { sendSuccess } from "../utils/api-response";
import { getAuth } from "../types/authed-request";

export const getPortfolio = async (req: Request, res: Response) => {
    const userPortfolio = await getUserPortfolio(getAuth(req).userId)
    sendSuccess(res, userPortfolio)
}
