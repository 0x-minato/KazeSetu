import { Request, Response } from "express"
import { sendSuccess } from "../utils/api-response"
import { getPrice, getPrices, updatePrice } from "./prices.service"
import { chainIDQueryDTO, TokenAddressParamsDTO } from "../tokens/tokens.dto"
import { VerifyPriceDTO } from "./prices.dto"

export const getPricesForSupportedTokens = async (_req: Request, res: Response) => {
    const prices = await getPrices()
    sendSuccess(res, prices)
}

export const getPriceForSupportedToken = async (req: Request, res: Response) => {
    const { address } = req.params as TokenAddressParamsDTO
    const { chainId } = req.query as unknown as chainIDQueryDTO
    const price = await getPrice(address, chainId)
    sendSuccess(res, price)
}

export const updatePriceForSupportedToken = async (req: Request, res: Response) => {
    const { address } = req.params as TokenAddressParamsDTO
    const { chainId } = req.query as unknown as chainIDQueryDTO
    const { priceUsd }  = req.body as VerifyPriceDTO
    const priceUpdated = await updatePrice(address, chainId, priceUsd)
    sendSuccess(res, priceUpdated)
}
