import z from "zod"

export const swapTxHashParamsSchema = z.object({
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid txHash format")
    .transform((value) => value.toLowerCase()),
})

export const chainIdQuerySchema = z.object({
  chainId: z.coerce.number().int().positive(),
})

export type SwapTxHashParamsDTO = z.infer<typeof swapTxHashParamsSchema>
export type ChainIdQueryDTO = z.infer<typeof chainIdQuerySchema>
