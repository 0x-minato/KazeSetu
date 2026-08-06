import { prisma } from "../config/database"
import { notFound } from "../utils/api-error"

export const findTokenPrices = () => {
    return prisma.tokenPrice.findMany({
        where: {
            token: {
                isActive: true
            }
        },
        include: {
            token: {
                select: {
                    address: true, chainId: true, symbol: true
                }
            }
        }
    })
}

export const findTokenPriceByAddressAndChainId = (address: string, chainId: number) => {
    return prisma.token.findUnique({
        where: {
            chainId_address: {
                address, 
                chainId
            }
        },
        include: {
            price: {
                select: {
                    priceUsd: true,
                    updatedAt: true
                }
            }
        }
    })
}

export const updateTokenPrice = (address: string, chainId: number, priceUsd: string) => {
    return prisma.$transaction(async(tx) => {
        const token = await tx.token.findUnique({
            where: {
                chainId_address: {
                    chainId, 
                    address
                }
            }
        })

        if (!token || !token.isActive) throw notFound("token not found")

        return await tx.token.update({
            where: {
                chainId_address: {
                    address, 
                    chainId
                }
            }, 
            data: {
                price: {
                    upsert: {
                        create: { priceUsd },
                        update: { priceUsd }
                    }
                }
            },
            include: {
                price: {
                    select: {
                        priceUsd: true, 
                        updatedAt: true
                    }
                }
            }
        })
    })
}