import z from 'zod'

export const verifyAuthSchema = z.object({
    message: z.string().min(1),
    signature: 
    z.string()
    .regex(/^0x(?:[0-9a-fA-F]{2})+$/, "Invalid signature format"),
})

export type verifyAuthDTO = z.infer<typeof verifyAuthSchema>