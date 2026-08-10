import { Request, Response } from "express";
import { addToken, getToken, getTokens } from "./tokens.service";
import { sendSuccess } from "../utils/api-response";
import { ChainIdQueryDTO, TokenAddressParamsDTO, TokenBodyDTO } from "./tokens.dto";

export const getSupportedTokens = async (_req: Request, res: Response) => {
    const tokens = await getTokens()
    sendSuccess(res, tokens)
}

export const getSupportedToken = async (req: Request, res: Response) => {
    const { address } = req.params as TokenAddressParamsDTO
    const { chainId } = req.query as unknown as ChainIdQueryDTO
    const token = await getToken(address, chainId)
    sendSuccess(res, token)
}

export const addSupportedToken = async (req: Request, res: Response) => {
    const tokenDetails = req.body as TokenBodyDTO
    const newToken = await addToken(tokenDetails)
    sendSuccess(res, newToken)
}
