import z from "zod"
import {
    addressParamsSchema,
    chainIdSchema,
    ethAddressSchema,
    nonNegativeDecimalSchema,
    txHashParamsSchema,
} from "../dto/common"

export const vaultAddressParamsSchema = addressParamsSchema
export const vaultTxHashParamsSchema = txHashParamsSchema

const uintStringSchema = z
    .string()
    .trim()
    .regex(/^(?:0|[1-9]\d*)$/, "Invalid unsigned integer format")

export const vaultBodySchema = z.object({
    vault: z.object({
        address: ethAddressSchema,
        chainId: chainIdSchema,
        name: z.string().trim().min(1),
        symbol: z.string().trim().min(1),
        poolAddress: ethAddressSchema,
        managerAddress: ethAddressSchema,
        swapRouterAddress: ethAddressSchema,
        fee: z.coerce.number().int().positive(),
        tickLower: z.coerce.number().int(),
        tickUpper: z.coerce.number().int(),
        tokenId: uintStringSchema.optional().default("0"),
        liquidity: nonNegativeDecimalSchema.optional().default("0"),
        amount0: nonNegativeDecimalSchema.optional().default("0"),
        amount1: nonNegativeDecimalSchema.optional().default("0"),
        totalSupply: nonNegativeDecimalSchema.optional().default("0"),
        sqrtPriceX96: uintStringSchema.optional().default("0"),
        currentTick: z.coerce.number().int().optional().default(0),
        isPaused: z.boolean().optional().default(false),
        isActive: z.boolean().optional().default(true),
    }),
})

export const vaultStateBodySchema = z.object({
    tickLower: z.coerce.number().int().optional(),
    tickUpper: z.coerce.number().int().optional(),
    currentTick: z.coerce.number().int().optional(),
    sqrtPriceX96: uintStringSchema.optional(),
    tokenId: uintStringSchema.optional(),
    liquidity: nonNegativeDecimalSchema,
    amount0: nonNegativeDecimalSchema,
    amount1: nonNegativeDecimalSchema,
    totalSupply: nonNegativeDecimalSchema,
    isPaused: z.boolean().optional(),
    isActive: z.boolean().optional(),
})

export type VaultAddressParamsDTO = z.infer<typeof vaultAddressParamsSchema>
export type VaultTxHashParamsDTO = z.infer<typeof vaultTxHashParamsSchema>
export type VaultBodyDTO = z.infer<typeof vaultBodySchema>
export type VaultStateBodyDTO = z.infer<typeof vaultStateBodySchema>
export { chainIdQuerySchema, type ChainIdQueryDTO } from "../dto/common"
