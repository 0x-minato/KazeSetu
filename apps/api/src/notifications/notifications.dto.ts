import z from "zod"
import { NotificationType } from "../../app/generated/prisma/enums"
import {
    chainIdSchema,
    ethAddressSchema,
    txHashSchema,
} from "../dto/common"

export const notificationIdParamsSchema = z.object({
    id: z.string().trim().min(1, "Notification id is required"),
})

export const createNotificationBodySchema = z.object({
    walletAddress: ethAddressSchema,
    chainId: chainIdSchema,
    type: z.nativeEnum(NotificationType),
    title: z.string().trim().min(1),
    message: z.string().trim().min(1),
    txHash: txHashSchema.optional(),
})

export type NotificationIdParamsDTO = z.infer<typeof notificationIdParamsSchema>
export type CreateNotificationBodyDTO = z.infer<typeof createNotificationBodySchema>
