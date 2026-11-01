import { NotificationType } from "../../app/generated/prisma/enums"

export interface NotificationData {
    id: string
    chainId: number
    type: NotificationType
    title: string
    message: string
    txHash: string | null
    isRead: boolean
    createdAt: string
}
