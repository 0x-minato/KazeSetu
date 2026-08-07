import { Decimal } from "@prisma/client/runtime/client"

export interface Position {
    address: string
    chainId: number
    symbol: string
    decimals: number
    balance: string
    priceUsd: string
    valueUsd: string
}

export interface Portfolio {
    positions: Position[],
    totalValueUsd: string
}