import { conflict, notFound } from "../utils/api-error"
import { TokenBodyDTO } from "./tokens.dto"
import { addNewToken, findSupportedTokenByAddressAndChainId, findSupportedTokens } from "./tokens.repository"
import { Token } from "./tokens.types"

export const getTokens = async (): Promise<Token[]> => {
    const tokens = await findSupportedTokens()
    if (tokens.length === 0) return []
    const configuredTokens: Token[] = tokens.map((token) => ({
        address: token.address,
        chainId: token.chainId,
        isActive: token.isActive,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals
    }))
    return configuredTokens
}

export const getToken = async (address: string, chainId: number): Promise<Token> => {
    const token = await findSupportedTokenByAddressAndChainId(address, chainId)
    if (!token || !token.isActive) throw notFound("token not found")
    return {
        address: token.address,
        chainId: token.chainId,
        decimals: token.decimals,
        isActive: token.isActive,
        name: token.name,
        symbol: token.symbol
    }
}

export const addToken = async (tokenDetails: TokenBodyDTO): Promise<Token> => {
    const duplicateToken = await findSupportedTokenByAddressAndChainId(
        tokenDetails.address,
        tokenDetails.chainId
    )
    if (duplicateToken) throw conflict("Duplicate token found")

    const token = await addNewToken(
        tokenDetails.address,
        tokenDetails.chainId,
        tokenDetails.decimals,
        tokenDetails.isActive,
        tokenDetails.name,
        tokenDetails.symbol,
    )
    return {
        address: token.address,
        chainId: token.chainId,
        decimals: token.decimals,
        isActive: token.isActive,
        name: token.name,
        symbol: token.symbol
    }
}