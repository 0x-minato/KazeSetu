export class ApiError extends Error {
    readonly statusCode: number
    readonly details?: unknown

    constructor(
        statusCode: number,
        message: string,
        details?: unknown
    ) {
        super(message)
        this.statusCode = statusCode
        this.details = details
        this.name = "API Error"
        Error.captureStackTrace(this, this.constructor)
    }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, message, details)
export const notFound = (message: string, details?: unknown) => new ApiError(404, message, details);
export const internalServerError = (message = "Internal server error") => new ApiError(500, message);
export const unauthorized = (message: string, details?: unknown) => new ApiError(401, message, details);
export const forbidden = (message: string, details?: unknown) => new ApiError(403, message, details);
export const conflict = (message: string, details?: unknown) => new ApiError(409, message, details);
export const tooManyRequests = (message = "Too many requests", details?: unknown) =>
  new ApiError(429, message, details);