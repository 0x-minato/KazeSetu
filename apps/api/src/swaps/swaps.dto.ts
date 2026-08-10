import z from "zod"
import { txHashParamsSchema } from "../dto/common"

export const swapTxHashParamsSchema = txHashParamsSchema

export type SwapTxHashParamsDTO = z.infer<typeof swapTxHashParamsSchema>
export { chainIdQuerySchema, type ChainIdQueryDTO } from "../dto/common"
