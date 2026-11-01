import { Decimal } from "@prisma/client/runtime/client"
import { Prisma } from "../../app/generated/prisma/client.js"
import { getActivePoolByAddressAndChainId } from "../pools/pools.service"
import { getPriceUsdOrZero } from "../prices/prices.service"
import { badRequest, conflict, internalServerError, notFound } from "../utils/api-error"
import { VaultBodyDTO, VaultStateBodyDTO } from "./vaults.dto"
import {
    toVaultData,
    toVaultEventData,
    toVaultPositionData,
    VaultFromRepo,
} from "./vaults.mapper"
import {
    createClVault,
    getAllActiveVaults,
    getUserVaultEventByTxHashAndChainId,
    getUserVaultEvents,
    getUserVaultPositions,
    getVaultByAddressAndChainId,
    updateClVaultState,
} from "./vaults.repository"
import { VaultData, VaultEventData, VaultPositionData } from "./vaults.types"

const computeVaultWithPrices = async (
    vault: VaultFromRepo,
    priceCache?: Map<string, Decimal>,
): Promise<{ vaultData: VaultData; price0Usd: Decimal; price1Usd: Decimal }> => {
    const getPrice = async (tokenAddress: string, chainId: number) => {
        const key = `${chainId}:${tokenAddress.toLowerCase()}`
        if (priceCache) {
            const cached = priceCache.get(key)
            if (cached) return cached
        }
        const price = await getPriceUsdOrZero(tokenAddress, chainId)
        if (priceCache) {
            priceCache.set(key, price)
        }
        return price
    }

    const [price0Usd, price1Usd] = await Promise.all([
        getPrice(vault.pool.token0.address, vault.chainId),
        getPrice(vault.pool.token1.address, vault.chainId),
    ])

    const tvlUsd = vault.amount0
        .mul(price0Usd)
        .add(vault.amount1.mul(price1Usd))
        .toString()

    return {
        vaultData: toVaultData(vault, tvlUsd),
        price0Usd,
        price1Usd,
    }
}

export const getVaultsService = async (): Promise<VaultData[]> => {
    const vaults = await getAllActiveVaults()
    const priceCache = new Map<string, Decimal>()
    const results: VaultData[] = []

    for (const vault of vaults) {
        const { vaultData } = await computeVaultWithPrices(vault, priceCache)
        results.push(vaultData)
    }

    return results
}

export const getVaultService = async (
    address: string,
    chainId: number,
): Promise<VaultData> => {
    const vault = await getVaultByAddressAndChainId(address, chainId)
    if (
        !vault ||
        !vault.isActive ||
        !vault.pool.isActive ||
        !vault.pool.token0.isActive ||
        !vault.pool.token1.isActive
    ) {
        throw notFound("Vault not found")
    }

    const { vaultData } = await computeVaultWithPrices(vault)
    return vaultData
}

export const getUserVaultPositionsService = async (
    address: string,
): Promise<VaultPositionData[]> => {
    const positions = await getUserVaultPositions(address)
    const priceCache = new Map<string, Decimal>()
    const results: VaultPositionData[] = []

    for (const position of positions) {
        const { vault } = position
        if (vault.totalSupply.equals(0)) {
            throw internalServerError("Vault total supply is zero", {
                address: vault.address,
                chainId: vault.chainId,
            })
        }

        const { vaultData, price0Usd, price1Usd } = await computeVaultWithPrices(
            vault,
            priceCache,
        )

        const shareRatio = position.shares.div(vault.totalSupply)
        const sharePct = shareRatio.mul(100).toString()
        const userAmount0 = shareRatio.mul(vault.amount0)
        const userAmount1 = shareRatio.mul(vault.amount1)
        const valueUsd = userAmount0
            .mul(price0Usd)
            .add(userAmount1.mul(price1Usd))
            .toString()

        results.push(
            toVaultPositionData(position, {
                sharePct,
                amount0: userAmount0.toString(),
                amount1: userAmount1.toString(),
                valueUsd,
                vault: vaultData,
            }),
        )
    }

    return results
}

export const getUserVaultEventsService = async (
    address: string,
): Promise<VaultEventData[]> => {
    const events = await getUserVaultEvents(address)
    const priceCache = new Map<string, Decimal>()
    const results: VaultEventData[] = []

    for (const event of events) {
        const { vaultData } = await computeVaultWithPrices(event.vault, priceCache)
        results.push(toVaultEventData(event, vaultData))
    }

    return results
}

export const getUserVaultEventService = async (
    address: string,
    chainId: number,
    txHash: string,
): Promise<VaultEventData> => {
    const event = await getUserVaultEventByTxHashAndChainId(address, chainId, txHash)
    if (!event) throw notFound("Vault event not found")

    const { vaultData } = await computeVaultWithPrices(event.vault)
    return toVaultEventData(event, vaultData)
}

export const createVaultService = async (
    body: VaultBodyDTO,
): Promise<VaultData> => {
    const { vault } = body

    if (vault.tickLower >= vault.tickUpper) {
        throw badRequest("tickLower must be less than tickUpper")
    }

    const existing = await getVaultByAddressAndChainId(vault.address, vault.chainId)
    if (existing) throw conflict("Duplicate vault found")

    const pool = await getActivePoolByAddressAndChainId(
        vault.poolAddress,
        vault.chainId,
    )

    try {
        const created = await createClVault({
            address: vault.address,
            chainId: vault.chainId,
            name: vault.name,
            symbol: vault.symbol,
            poolId: pool.id,
            managerAddress: vault.managerAddress,
            swapRouterAddress: vault.swapRouterAddress,
            fee: vault.fee,
            tickLower: vault.tickLower,
            tickUpper: vault.tickUpper,
            tokenId: vault.tokenId,
            liquidity: vault.liquidity,
            amount0: vault.amount0,
            amount1: vault.amount1,
            totalSupply: vault.totalSupply,
            sqrtPriceX96: vault.sqrtPriceX96,
            currentTick: vault.currentTick,
            isPaused: vault.isPaused,
            isActive: vault.isActive,
        })

        const { vaultData } = await computeVaultWithPrices(created)
        return vaultData
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            throw conflict("Duplicate vault found")
        }
        throw error
    }
}

export const updateVaultStateService = async (
    address: string,
    chainId: number,
    body: VaultStateBodyDTO,
): Promise<VaultData> => {
    const existing = await getVaultByAddressAndChainId(address, chainId)
    if (!existing) throw notFound("Vault not found")

    const nextTickLower = body.tickLower ?? existing.tickLower
    const nextTickUpper = body.tickUpper ?? existing.tickUpper
    if (nextTickLower >= nextTickUpper) {
        throw badRequest("tickLower must be less than tickUpper")
    }

    const updated = await updateClVaultState({
        address,
        chainId,
        tickLower: body.tickLower,
        tickUpper: body.tickUpper,
        currentTick: body.currentTick,
        sqrtPriceX96: body.sqrtPriceX96,
        tokenId: body.tokenId,
        liquidity: body.liquidity,
        amount0: body.amount0,
        amount1: body.amount1,
        totalSupply: body.totalSupply,
        isPaused: body.isPaused,
        isActive: body.isActive,
    })

    const { vaultData } = await computeVaultWithPrices(updated)
    return vaultData
}
