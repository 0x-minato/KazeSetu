import z from "zod"
import { addressParamsSchema, chainIdSchema, ethAddressSchema, nonNegativeDecimalSchema } from "../dto/common"

export const poolAddressParamsSchema = addressParamsSchema

const reserveSchema = nonNegativeDecimalSchema

export const poolBodySchema = z.object({
  pool: z.object({
    address: ethAddressSchema,
    chainId: chainIdSchema,
    token0Address: ethAddressSchema,
    token1Address: ethAddressSchema,
    feeBps: z.coerce.number().int().min(0).max(10_000),
    totalSupply: reserveSchema.optional().default("0"),
    reserve0: reserveSchema.optional().default("0"),
    reserve1: reserveSchema.optional().default("0"),
    isActive: z.boolean().optional().default(true),
  }).refine(
    (value) => value.token0Address !== value.token1Address,
    { message: "token0Address and token1Address must be different", path: ["token1Address"] },
  ),
})

export const poolStateBodySchema = z.object({
  totalSupply: reserveSchema,
  reserve0: reserveSchema,
  reserve1: reserveSchema,
  isActive: z.boolean().optional(),
})

export type PoolAddressParamsDTO = z.infer<typeof poolAddressParamsSchema>
export type PoolBodyDTO = z.infer<typeof poolBodySchema>
export type PoolStateBodyDTO = z.infer<typeof poolStateBodySchema>
export { chainIdQuerySchema, type ChainIdQueryDTO } from "../dto/common"
