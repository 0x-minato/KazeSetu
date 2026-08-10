import z from "zod"

export const ethAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address format")
  .transform((value) => value.toLowerCase())

export const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid txHash format")
  .transform((value) => value.toLowerCase())

export const chainIdSchema = z.coerce.number().int().positive()

export const chainIdQuerySchema = z.object({
  chainId: chainIdSchema,
})

export const addressParamsSchema = z.object({
  address: ethAddressSchema,
})

export const txHashParamsSchema = z.object({
  txHash: txHashSchema,
})

export type ChainIdQueryDTO = z.infer<typeof chainIdQuerySchema>
export type AddressParamsDTO = z.infer<typeof addressParamsSchema>
export type TxHashParamsDTO = z.infer<typeof txHashParamsSchema>
