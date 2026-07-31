import { Response } from 'express'

interface SuccessPayload<T> {
    success: true,
    data: T,
    message?: string 
}

export const sendSuccess = <T>(res: Response, data: T, statusCode = 200, message?: string) => {
    const body: SuccessPayload<T> = {
        success: true,
        data,
    }
    
    if (message) body.message = message
    res.status(statusCode).json({
        body
    })
}