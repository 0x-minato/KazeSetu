import { prisma } from "../config/database"


export const findSupportedTokens = () => {
    return prisma.token.findMany({
        where: {
            isActive: true
        }
    })
}

export const findSupportedTokenByAddressAndChainId = (address: string, chainId: number) => {
    return prisma.token.findUnique({
        where: {
            chainId_address: {
                address,
                chainId,
            },
        }
    })
}

export const addNewToken = (
    address: string,
    chainId: number,
    decimals: number,
    isActive: boolean,
    name: string,
    symbol: string
) => {
    return prisma.token.create({
        data: {
            address,
            chainId,
            decimals,
            name,
            symbol,
            isActive
        }
    })
}