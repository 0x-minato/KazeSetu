import { Decimal } from "@prisma/client/runtime/client"
import { findBalancesByUserId } from "./portfolio.repository"
import { Portfolio} from "./portfolio.types"

export const getUserPortfolio = async (userId: string): Promise<Portfolio> => {
    const balances = await findBalancesByUserId(userId)
    let totalValueUsd = new Decimal(0)
    const byToken = new Map<string, {
        address: string
        chainId: number
        symbol: string
        decimals: number
        balance: Decimal
        priceUsd: Decimal
        valueUsd: Decimal
      }>()

    for (const balance of balances) {
        const price = balance.token.price?.priceUsd ?? new Decimal(0)
        const valueUsd = balance.amount.mul(price)
        totalValueUsd = totalValueUsd.add(valueUsd)

        const existing = byToken.get(balance.tokenId)
        if (existing) {
            existing.balance = existing.balance.add(balance.amount)
            existing.valueUsd = existing.valueUsd.add(valueUsd)
        } else {
            byToken.set(balance.tokenId, {
                address: balance.token.address,
                chainId: balance.token.chainId,
                decimals: balance.token.decimals,
                symbol: balance.token.symbol,
                priceUsd: price,
                balance: balance.amount,
                valueUsd: valueUsd
            })
        }
    }

    const positions = [...byToken.values()].map((position) => ({
        ...position,
        balance: position.balance.toString(),
        priceUsd: position.priceUsd.toString(),
        valueUsd: position.valueUsd.toString()
    }))

    return {
        positions,
        totalValueUsd: totalValueUsd.toString()
    }
}