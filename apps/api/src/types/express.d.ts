import type { AuthenticatedUser } from "../auth/auth.types"

declare module "express-serve-static-core" {
    interface Request {
        auth?: AuthenticatedUser
    }
}
