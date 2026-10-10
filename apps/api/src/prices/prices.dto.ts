import z from "zod"
import { nonNegativeDecimalSchema } from "../dto/common"

export const verifyPriceSchema = z.object({
  priceUsd: nonNegativeDecimalSchema,
})

export type VerifyPriceDTO = z.infer<typeof verifyPriceSchema>
