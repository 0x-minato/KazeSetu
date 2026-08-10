import z from "zod"
import { addressParamsSchema, chainIdSchema, ethAddressSchema } from "../dto/common"

export const tokenAddressParamsSchema = addressParamsSchema

export const tokenBodySchema = z.object({
  address: ethAddressSchema,
  chainId: chainIdSchema,
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
export type TokenBodyDTO = z.infer<typeof tokenBodySchema>
export { chainIdQuerySchema, type ChainIdQueryDTO } from "../dto/common"
