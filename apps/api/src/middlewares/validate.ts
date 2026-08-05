import { NextFunction, Request, Response } from "express"
import { ZodSchema } from "zod"
import { badRequest } from "../utils/api-error"

export const validateRequest =
    (source: "body" | "query" | "params") => 
    (schema: ZodSchema) => 
    (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[source])

        if (!result.success) { 
            next(badRequest("Validation Failed", result.error.issues)) 
            return
        }
        
        req[source] = result.data
        next()
}

export const validateBody = validateRequest("body")
export const validateQuery = validateRequest("query")
export const validateParams = validateRequest("params")