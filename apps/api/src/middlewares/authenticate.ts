import { NextFunction, Request, Response } from "express";
import { unauthorized } from "../utils/api-error";
import { jwtVerify } from "jose";
import { JWT_ACCESS_SECRET } from "../config/env"
import type {} from "../types/express"

const secret = new TextEncoder().encode(JWT_ACCESS_SECRET)

export const authenticateAccessToken = async(
    req: Request, 
    _res: Response,
    next: NextFunction
): Promise<void> => {
    const authorization = req.header("authorization")
    const [schema, token] = authorization?.split(" ") ?? []

    if (schema != "Bearer" || !token) {
        next(unauthorized("Access token is required"))
        return
    }

    try {
        const userId = await verifyAccessToken(token)
        req.auth = { userId }
        next()
    } catch(error) {
        next(error)
    }
}

const verifyAccessToken = async(
    token: string
): Promise<string> => {
    try {
        const { payload } = await jwtVerify(token, secret, {
            algorithms: ["HS256"]
        })
        if (typeof payload.sub !== "string" || !payload.sub) {
            throw unauthorized("Invalid Access Token")
        }
        return payload.sub
    } catch {
        throw unauthorized("Invalid or expired access token")
    }
}