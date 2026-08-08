import { conflict, notFound } from "../utils/api-error"
import { TokenBodyDTO } from "./tokens.dto"
import { toToken } from "./tokens.mapper"
import { addNewToken, findSupportedTokenByAddressAndChainId, findSupportedTokens } from "./tokens.repository"
import { ActiveToken, Token } from "./tokens.types"

export const getTokens = async (): Promise<Token[]> => {
    const tokens = await findSupportedTokens()
    if (tokens.length === 0) return []
    return tokens.map(toToken)
}

export const getActiveTokenByAddressAndChainId = async (
    address: string,
    chainId: number,
): Promise<ActiveToken> => {
    const token = await findSupportedTokenByAddressAndChainId(address, chainId)
    if (!token || !token.isActive) throw notFound("token not found")
    return {
        id: token.id,
        ...toToken(token),
    }
}
  
export const getToken = async (address: string, chainId: number): Promise<Token> => {
    const { id: _id, ...token } = await getActiveTokenByAddressAndChainId(address, chainId)
    return token
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
    return toToken(token)
}
