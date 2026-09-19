import { Token } from "../tokens/tokens.types";

export interface Pool {
    address: string
    chainId: number
    feeBps: number
    reserve0: string
    reserve1: string
    totalSupply: string
    token0: Token
    token1: Token
}
