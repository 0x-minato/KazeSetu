import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error";
import { NODE_ENV } from "../config/env";

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const body: Record<string, unknown> = {
        success: false, 
        message: ""
    }
    if (err instanceof ApiError) {
        body.message = err.message
        if (err.details) body.details = err.details
        res.status(err.statusCode).json(body)
        return
    }
    
    body.message = "something went wrong"
    if (NODE_ENV == 'development') body.details = err.stack
    res.status(500).json(body)
}