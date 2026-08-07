import { prisma } from "../config/database"

export const findBalancesByUserId = (userId: string) => {
    return prisma.walletBalance.findMany({
        where: {
            amount: { gt: 0},
            wallet: {
                userId
            },
            token: {
                isActive: true
            }
        },
        include: {
            token: {
                include: {
                    price: true
                }
            }
        }
    })
}