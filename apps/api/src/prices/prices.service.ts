import { notFound } from "../utils/api-error"
import { findTokenPriceByAddressAndChainId, findTokenPrices, updateTokenPrice } from "./prices.repository"
import { TokenPrice } from "./prices.types"

export const getPrices = async (): Promise<TokenPrice[]> => {
    const prices = await findTokenPrices()
    if (prices.length === 0) return []
    const configuredPrices: TokenPrice[] = prices.map((price) => ({
        address: price.token.address,
        chainId: price.token.chainId,
        symbol: price.token.symbol,
        priceUsd: price.priceUsd.toString(),
        updatedAt: price.updatedAt
    }))
    return configuredPrices
}

export const getPrice = async (address: string, chainId: number): Promise<TokenPrice> => {
    const token = await findTokenPriceByAddressAndChainId(address, chainId)    
    if (!token || !token.isActive || !token.price) throw notFound("price not found")
    return {
        address: token.address,
        chainId: token.chainId,
        symbol: token.symbol,
        priceUsd: token.price.priceUsd.toString(),
        updatedAt: token.price.updatedAt
    }   
}

export const updatePrice = async (
    address: string, 
    chainId: number, 
    priceUsd: string
): Promise<TokenPrice> => {
    const token = await updateTokenPrice(address, chainId, priceUsd)
    if (!token || !token.isActive || !token.price) throw notFound("price not found") 
    return {
        address: token.address,
        chainId: token.chainId,
        priceUsd: token.price.priceUsd.toString(),
        symbol: token.symbol,
        updatedAt: token.price.updatedAt
    }
}