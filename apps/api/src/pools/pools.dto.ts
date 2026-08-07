import z from "zod"

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address format")
  .transform((value) => value.toLowerCase())

export const poolAddressParamsSchema = z.object({
  address: addressSchema,
})

export const chainIdQuerySchema = z.object({
  chainId: z.coerce.number().int().positive(),
})

const reserveSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, "Invalid reserve format")
  .refine((value) => Number(value) >= 0, "reserve must be non-negative")

export const poolBodySchema = z.object({
  pool: z.object({
    address: addressSchema,
    chainId: z.coerce.number().int().positive(),
    token0Address: addressSchema,
    token1Address: addressSchema,
    feeBps: z.coerce.number().int().min(0).max(10_000),
    reserve0: reserveSchema.optional().default("0"),
    reserve1: reserveSchema.optional().default("0"),
    isActive: z.boolean().optional().default(true),
  }).refine(
    (value) => value.token0Address !== value.token1Address,
    { message: "token0Address and token1Address must be different", path: ["token1Address"] },
  )
})

export type PoolAddressParamsDTO = z.infer<typeof poolAddressParamsSchema>
export type ChainIdQueryDTO = z.infer<typeof chainIdQuerySchema>
export type PoolBodyDTO = z.infer<typeof poolBodySchema>
