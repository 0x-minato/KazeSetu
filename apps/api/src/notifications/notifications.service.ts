import { notFound } from "../utils/api-error"
import { CreateNotificationBodyDTO } from "./notifications.dto"
import {
    getNotificationByIdForWallet,
    getUserNotifications,
    markAllNotificationsReadForWallet,
    markNotificationReadById,
    upsertWalletAndCreateNotification,
} from "./notifications.repository"
import { NotificationData } from "./notifications.types"

type NotificationFromRepo = Awaited<ReturnType<typeof getUserNotifications>>[number]

const toNotificationData = (notification: NotificationFromRepo): NotificationData => ({
    id: notification.id,
    chainId: notification.chainId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    txHash: notification.txHash ?? null,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
})

export const getUserNotificationsService = async (
    address: string,
): Promise<NotificationData[]> => {
    const notifications = await getUserNotifications(address, 50)
    return notifications.map(toNotificationData)
}

export const markNotificationReadService = async (
    address: string,
    id: string,
): Promise<NotificationData> => {
    const existing = await getNotificationByIdForWallet(id, address)
    if (!existing) throw notFound("Notification not found")

    if (existing.isRead) {
        return toNotificationData(existing)
    }

    const updated = await markNotificationReadById(id)
    return toNotificationData(updated)
}

export const markAllNotificationsReadService = async (
    address: string,
): Promise<{ updatedCount: number }> => {
    const result = await markAllNotificationsReadForWallet(address)
    return { updatedCount: result.count }
}

export const createNotificationService = async (
    body: CreateNotificationBodyDTO,
): Promise<NotificationData> => {
    const created = await upsertWalletAndCreateNotification({
        walletAddress: body.walletAddress.toLowerCase(),
        chainId: body.chainId,
        type: body.type,
        title: body.title,
        message: body.message,
        txHash: body.txHash,
    })

    return toNotificationData(created)
}
