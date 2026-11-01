import { Router } from "express"
import {
    authenticateAccessToken,
    authenticateWorkerOrAdmin,
} from "../middlewares/authenticate"
import { validateBody, validateParams } from "../middlewares/validate"
import {
    createNotification,
    getMyNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from "./notifications.controller"
import {
    createNotificationBodySchema,
    notificationIdParamsSchema,
} from "./notifications.dto"

export const notificationRouter: Router = Router()

notificationRouter.get("/me", authenticateAccessToken, getMyNotifications)
notificationRouter.patch(
    "/:id/read",
    authenticateAccessToken,
    validateParams(notificationIdParamsSchema),
    markNotificationRead,
)
notificationRouter.post(
    "/read-all",
    authenticateAccessToken,
    markAllNotificationsRead,
)
notificationRouter.post(
    "/",
    authenticateWorkerOrAdmin,
    validateBody(createNotificationBodySchema),
    createNotification,
)
