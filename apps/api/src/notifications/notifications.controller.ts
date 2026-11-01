import { Request, Response } from "express"
import { getAuth } from "../types/authed-request"
import { sendSuccess } from "../utils/api-response"
import {
    CreateNotificationBodyDTO,
    NotificationIdParamsDTO,
} from "./notifications.dto"
import {
    createNotificationService,
    getUserNotificationsService,
    markAllNotificationsReadService,
    markNotificationReadService,
} from "./notifications.service"

export const getMyNotifications = async (req: Request, res: Response) => {
    const notifications = await getUserNotificationsService(getAuth(req).address)
    sendSuccess(res, notifications)
}

export const markNotificationRead = async (req: Request, res: Response) => {
    const { id } = req.params as NotificationIdParamsDTO
    const notification = await markNotificationReadService(getAuth(req).address, id)
    sendSuccess(res, notification)
}

export const markAllNotificationsRead = async (req: Request, res: Response) => {
    const result = await markAllNotificationsReadService(getAuth(req).address)
    sendSuccess(res, result)
}

export const createNotification = async (req: Request, res: Response) => {
    const body = req.body as CreateNotificationBodyDTO
    const notification = await createNotificationService(body)
    sendSuccess(res, notification, 201)
}
