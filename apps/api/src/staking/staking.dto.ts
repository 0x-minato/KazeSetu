import z from "zod"
import {
  addressParamsSchema,
  chainIdSchema,
  ethAddressSchema,
  txHashParamsSchema,
} from "../dto/common"

export const stakingTxHashParamsSchema = txHashParamsSchema
export const farmAddressParamsSchema = addressParamsSchema

export const farmBodySchema = z.object({
  farm: z.object({
    address: ethAddressSchema,
    chainId: chainIdSchema,
    poolAddress: ethAddressSchema,
    rewardTokenAddress: ethAddressSchema,
    isActive: z.boolean().optional().default(true),
  }),
})

export type StakingTxHashParamsDTO = z.infer<typeof stakingTxHashParamsSchema>
export type FarmAddressParamsDTO = z.infer<typeof farmAddressParamsSchema>
export type FarmBodyDTO = z.infer<typeof farmBodySchema>
export { chainIdQuerySchema, type ChainIdQueryDTO } from "../dto/common"
