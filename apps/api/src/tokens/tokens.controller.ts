import { Request, Response } from "express";
import { unauthorized } from "../utils/api-error";
import { addToken, getToken, getTokens } from "./tokens.service";
import { sendSuccess } from "../utils/api-response";
import { chainIDQueryDTO, TokenAddressParamsDTO, TokenBodyDTO } from "./tokens.dto";

export const getSupportedTokens = async (req: Request, res: Response) => {
    if (!req.auth?.userId) throw unauthorized("Unauthorized")
    const tokens = await getTokens()
    sendSuccess(res, tokens)
}

export const getSupportedToken = async (req: Request, res: Response) => {
    if (!req.auth?.userId) throw unauthorized("Unauthorized")
    const { address } = req.params as TokenAddressParamsDTO
    const { chainId } = req.query as unknown as chainIDQueryDTO
    const token = await getToken(address, chainId)
    sendSuccess(res, token)
}

export const addSupportedToken = async (req: Request, res: Response) => {
    if (!req.auth?.userId) throw unauthorized("Unauthorized")
    const tokenDetails = req.body as TokenBodyDTO
    const newToken = await addToken(tokenDetails)
    sendSuccess(res, newToken)
} 
