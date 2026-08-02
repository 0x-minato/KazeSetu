import { Request, Response } from "express";
import { generateNonce, verifyAuthentication, replaceRefreshTokenService, logoutService } from "./auth.service";
import { sendSuccess } from "../utils/api-response";
import { NODE_ENV, REFRESH_TOKEN_TTL_MS } from "../config/env";
import { unauthorized } from '../utils/api-error.ts'

export const nonceController = (_req: Request, res: Response) => {
    const nonce = generateNonce()
    sendSuccess(res, nonce)
}

export const verifyController = async (req: Request, res: Response) => {
    const { message, signature } = req.body
    const { 
        refreshToken, 
        ...rest
    } = await verifyAuthentication({message, signature})

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: NODE_ENV === "production", 
        sameSite: "lax",
        maxAge: REFRESH_TOKEN_TTL_MS,
        path: "/api/auth"
    })
    sendSuccess(res, rest)
}

export const refreshController = async(req: Request, res: Response) => {
    const refreshTokenCookie = req.cookies?.refreshToken
    if(typeof refreshTokenCookie !== "string" || !refreshTokenCookie) {
        throw unauthorized("Refresh token is required")
    }
    const result = await replaceRefreshTokenService(refreshTokenCookie)
    res.cookie("refreshToken", result.newRefreshToken, {
        httpOnly: true,
        secure: NODE_ENV === "production", 
        sameSite: "lax",
        maxAge: REFRESH_TOKEN_TTL_MS,
        path: "/api/auth"
    })
    sendSuccess(res, result.newAccessToken)
}

export const logoutController = async(req: Request, res: Response) => {
    const refreshTokenCookie = req.cookies?.refreshToken
    if(typeof refreshTokenCookie == "string" && refreshTokenCookie) {
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