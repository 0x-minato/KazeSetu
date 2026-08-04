import { prisma } from "../config/database"
import { conflict } from "../utils/api-error"

export const findUserById = (id: string) => {
    return prisma.user.findUnique({
        where: {
            id
        },
        include: {
            wallets: true
        }
    })
}

export const findWalletByAddress = (address: string) => {
    return prisma.wallet.findUnique({
        where: {
            address
        }
    })
}

export const deleteWalletForUser = (address: string) => {
    return prisma.wallet.delete({
        where: {
            address
        }
    })
}

export const createWalletByUserId = (userId: string, address: string) => {
    return prisma.$transaction(async(tx) => {
        const wallet = await tx.wallet.findUnique({
            where: {
                address,
            }
        })

        if (wallet && wallet.userId === userId) { 
            return { 
                walletId: wallet.id,
                address: wallet.address,
                isCreated: false 
            }
        } 
        else if (wallet && wallet.userId !== userId) { 
            throw conflict("this address belongs to different user")
        }

        const newWallet = await tx.wallet.create({
            data: {
                address,
                userId
            }
        })

        return {
            walletId: newWallet.id,
            address: newWallet.address,
            isCreated: true
        }
    })
}