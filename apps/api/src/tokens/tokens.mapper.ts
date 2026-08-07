import { Token } from "./tokens.types"

export const toToken = (token: {
    address: string
    chainId: number
    name: string
    symbol: string
    decimals: number
    isActive: boolean
  }): Token => ({
    address: token.address,
    chainId: token.chainId,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    isActive: token.isActive,
})