import { NextFunction, Request, Response } from "express"
import { ZodSchema } from "zod"
import { badRequest } from "../utils/api-error"

export const validate = (schema: ZodSchema) => 
    (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body)

        if (!result.success) { 
            next(badRequest("Validation Failed", result.error.issues)) 
            return
        }
        
        req.body = result.data
        next()
}