import z from "zod"

export const liquidityTxHashParamsSchema = z.object({
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid txHash format")
    .transform((value) => value.toLowerCase()),
})

export const chainIdQuerySchema = z.object({
  chainId: z.coerce.number().int().positive(),
})

export type LiquidityTxHashParamsDTO = z.infer<typeof liquidityTxHashParamsSchema>
export type ChainIdQueryDTO = z.infer<typeof chainIdQuerySchema>
