import { NotificationType, Role } from "../../app/generated/prisma/enums"
import { prisma } from "../config/database"
import { ADMIN_ADDRESS } from "../config/env"

export const getUserNotifications = (address: string, limit = 50) => {
    return prisma.notification.findMany({
        where: {
            wallet: { address },
        },
        orderBy: {
            createdAt: "desc",
        },
        take: limit,
    })
}

export const getNotificationByIdForWallet = (id: string, address: string) => {
    return prisma.notification.findFirst({
        where: {
            id,
            wallet: { address },
        },
    })
}

export const markNotificationReadById = (id: string) => {
    return prisma.notification.update({
        where: { id },
        data: { isRead: true },
    })
}

export const markAllNotificationsReadForWallet = (address: string) => {
    return prisma.notification.updateMany({
        where: {
            wallet: { address },
            isRead: false,
        },
        data: {
            isRead: true,
        },
    })
}

export const upsertWalletAndCreateNotification = (input: {
    walletAddress: string
    chainId: number
    type: NotificationType
    title: string
    message: string
    txHash?: string
}) => {
    const normalizedAddress = input.walletAddress.toLowerCase()
    const role =
        ADMIN_ADDRESS !== "" && normalizedAddress === ADMIN_ADDRESS
            ? Role.ADMIN
            : Role.USER

    return prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.upsert({
            where: { address: normalizedAddress },
            update: {},
            create: {
                address: normalizedAddress,
                role,
            },
        })

        return tx.notification.create({
            data: {
                walletId: wallet.id,
                chainId: input.chainId,
                type: input.type,
                title: input.title,
                message: input.message,
                txHash: input.txHash ?? null,
            },
        })
    })
}
