export interface Token {
    address: string,
    chainId: number,
    name: string,
    symbol: string,
    decimals: number,
    isActive: boolean
}

export interface ActiveToken extends Token {
    id: string
}