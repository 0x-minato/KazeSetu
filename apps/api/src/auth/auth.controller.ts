import { Request, Response } from "express";
import { generateNonce, verifyAuthentication, replaceRefreshTokenService, logoutService } from "./auth.service";
import { sendSuccess } from "../utils/api-response";
import { NODE_ENV } from "../config/env";
import { unauthorized } from '../utils/api-error.ts'

const setRefreshTokenCookie = (
    res: Response,
    refreshToken: string,
    expiresAt: Date,
) => {
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: NODE_ENV === "production",
        sameSite: "lax",
        maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
        path: "/api/auth",
    })
}

export const nonceController = (_req: Request, res: Response) => {
    const nonce = generateNonce()
    sendSuccess(res, nonce)
}

export const verifyController = async (req: Request, res: Response) => {
    const { message, signature } = req.body
    const { 
        refreshToken,
        refreshTokenExpiresAt,
        ...rest
    } = await verifyAuthentication({message, signature})

    setRefreshTokenCookie(res, refreshToken, refreshTokenExpiresAt)
    sendSuccess(res, rest)
}

export const refreshController = async(req: Request, res: Response) => {
    const refreshTokenCookie = req.cookies?.refreshToken
    if(typeof refreshTokenCookie !== "string" || !refreshTokenCookie) {
        throw unauthorized("Refresh token is required")
    }
    const result = await replaceRefreshTokenService(refreshTokenCookie)
    setRefreshTokenCookie(
        res,
        result.newRefreshToken,
        result.refreshTokenExpiresAt,
    )
    sendSuccess(res, result.newAccessToken)
}

export const logoutController = async(req: Request, res: Response) => {
    const refreshTokenCookie = req.cookies?.refreshToken
    if(typeof refreshTokenCookie === "string" && refreshTokenCookie) {
        await logoutService(refreshTokenCookie)
    }
    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth"
    })
    sendSuccess(res, true)
}