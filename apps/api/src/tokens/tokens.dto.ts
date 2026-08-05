import z from "zod"

export const tokenAddressParamsSchema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address format")
    .transform((value) => value.toLowerCase()),
})

export const chainIdQuerySchema = z.object({
  chainId: z
    .coerce
    .number()
    .int()
    .positive()
})

export const tokenBodySchema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address format")
    .transform((value) => value.toLowerCase()),
  chainId: z.coerce.number().int().positive(),
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(128),
  decimals: z.coerce.number().int().min(0).max(255),
  isActive: z.boolean().optional().default(true),
})

export type TokenAddressParamsDTO = z.infer<typeof tokenAddressParamsSchema>
export type chainIDQueryDTO = z.infer<typeof chainIdQuerySchema>
export type TokenBodyDTO = z.infer<typeof tokenBodySchema>
