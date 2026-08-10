import z from "zod"
import { txHashParamsSchema } from "../dto/common"

export const liquidityTxHashParamsSchema = txHashParamsSchema

export type LiquidityTxHashParamsDTO = z.infer<typeof liquidityTxHashParamsSchema>
export { chainIdQuerySchema, type ChainIdQueryDTO } from "../dto/common"
