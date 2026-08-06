import z from "zod"

export const verifyPriceSchema = z.object({
  priceUsd: z
    .string()
    .trim()
    .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, "Invalid priceUsd format")
    .refine((value) => Number(value) >= 0, "priceUsd must be non-negative"),
})

export type VerifyPriceDTO = z.infer<typeof verifyPriceSchema>
