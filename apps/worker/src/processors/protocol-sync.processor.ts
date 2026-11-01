import { Queue, Worker, type Job } from "bullmq"
import { createPublicClient, http, type Address, type PublicClient } from "viem"
import {
  ERC20_ABI,
  KAZE_CL_VAULT_ABI,
  NONFUNGIBLE_POSITION_MANAGER_ABI,
  QUEUE_NAMES,
  UNISWAP_V3_POOL_ABI,
  formatUnitsDecimal,
  getAmountsForLiquidity,
  getSqrtRatioAtTick,
  type ProtocolSyncJobPayload,
} from "../../../../packages/shared/src/index.ts"
import { ADMIN_ADDRESS, getRpcUrlForChain } from "../config/env.js"
import { createRedisConnection } from "../config/redis.js"
import { prisma } from "../config/db.js"
import { workerApiClient, type ApiTokenItem } from "../lib/api-client.js"
import { enqueueNotification } from "./notification.processor.js"

const DEFILLAMA_CHAIN_PREFIX: Record<number, string> = {
  1: "ethereum",
  10: "optimism",
  137: "polygon",
  8453: "base",
  42161: "arbitrum",
}

const FALLBACK_SYMBOL_USD: Record<string, string> = {
  WETH: "2500",
  ETH: "2500",
  WBTC: "65000",
  BTC: "65000",
  USDC: "1",
  USDT: "1",
  DAI: "1",
  KAZE: "1.25",
}

const clientCache = new Map<number, PublicClient>()

const getPublicClient = (chainId: number): PublicClient | null => {
  const cached = clientCache.get(chainId)
  if (cached) return cached

  const rpcUrl = getRpcUrlForChain(chainId)
  if (!rpcUrl) return null

  const client = createPublicClient({
    transport: http(rpcUrl, { timeout: 15_000 }),
  })
  clientCache.set(chainId, client)
  return client
}

export const protocolSyncQueue = new Queue<ProtocolSyncJobPayload>(
  QUEUE_NAMES.PROTOCOL_SYNC,
  {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 3_000,
      },
      removeOnComplete: 100,
      removeOnFail: 250,
    },
  },
)

const formatPriceDecimal = (price: number): string => {
  if (!Number.isFinite(price) || price < 0) return "0"
  if (price === 0) return "0"
  const fixed = price.toFixed(18).replace(/\.?0+$/, "")
  return fixed === "" ? "0" : fixed
}

const loadActiveTokens = async (
  chainId?: number,
): Promise<ApiTokenItem[]> => {
  try {
    const tokens = await workerApiClient.getTokens()
    return chainId ? tokens.filter((t) => t.chainId === chainId) : tokens
  } catch {
    const rows = await prisma.token.findMany({
      where: {
        isActive: true,
        ...(chainId ? { chainId } : {}),
      },
    })
    return rows.map((r) => ({
      address: r.address,
      chainId: r.chainId,
      name: r.name,
      symbol: r.symbol,
      decimals: r.decimals,
      isActive: r.isActive,
    }))
  }
}

const syncPrices = async (chainId?: number): Promise<void> => {
  const tokens = await loadActiveTokens(chainId)
  if (tokens.length === 0) return

  const llamaKeys: string[] = []
  const keyToToken = new Map<string, ApiTokenItem[]>()

  for (const token of tokens) {
    const prefix = DEFILLAMA_CHAIN_PREFIX[token.chainId]
    if (prefix) {
      const key = `${prefix}:${token.address.toLowerCase()}`
      llamaKeys.push(key)
      const list = keyToToken.get(key) ?? []
      list.push(token)
      keyToToken.set(key, list)
    }
  }

  const resolvedPrices = new Map<string, string>()

  if (llamaKeys.length > 0) {
    try {
      const url = `https://coins.llama.fi/prices/current/${llamaKeys.join(",")}`
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (res.ok) {
        const data = (await res.json()) as {
          coins?: Record<string, { price?: number }>
        }
        const coins = data.coins ?? {}
        for (const [key, info] of Object.entries(coins)) {
          if (typeof info?.price === "number" && info.price > 0) {
            const matched = keyToToken.get(key.toLowerCase()) ?? []
            for (const t of matched) {
              resolvedPrices.set(
                `${t.chainId}:${t.address.toLowerCase()}`,
                formatPriceDecimal(info.price),
              )
            }
          }
        }
      }
    } catch (err) {
      console.warn(
        `[worker:sync-prices] DefiLlama query failed, using symbol fallbacks: ${(err as Error).message}`,
      )
    }
  }

  for (const token of tokens) {
    const mapKey = `${token.chainId}:${token.address.toLowerCase()}`
    let priceUsd = resolvedPrices.get(mapKey)

    if (!priceUsd) {
      const upperSymbol = token.symbol.trim().toUpperCase()
      priceUsd = FALLBACK_SYMBOL_USD[upperSymbol]
    }

    if (!priceUsd) continue

    try {
      await workerApiClient.updateTokenPrice(
        token.address,
        token.chainId,
        priceUsd,
      )
    } catch (err) {
      console.warn(
        `[worker:sync-prices] API PUT /api/prices/${token.address} failed (${(err as Error).message}), writing directly via Prisma`,
      )
      const dbToken = await prisma.token.findUnique({
        where: {
          chainId_address: {
            chainId: token.chainId,
            address: token.address.toLowerCase(),
          },
        },
      })
      if (dbToken) {
        await prisma.tokenPrice.upsert({
          where: { tokenId: dbToken.id },
          update: { priceUsd },
          create: { tokenId: dbToken.id, priceUsd },
        })
      }
    }
  }
}

const syncPools = async (
  chainId?: number,
  targetAddress?: string,
): Promise<void> => {
  const pools = await prisma.pool.findMany({
    where: {
      isActive: true,
      ...(chainId ? { chainId } : {}),
      ...(targetAddress ? { address: targetAddress.toLowerCase() } : {}),
    },
    include: {
      token0: true,
      token1: true,
    },
  })

  for (const pool of pools) {
    const client = getPublicClient(pool.chainId)
    if (!client) continue

    try {
      const poolAddr = pool.address as Address
      const token0Addr = pool.token0.address as Address
      const token1Addr = pool.token1.address as Address

      const [rawReserve0, rawReserve1, rawTotalSupply] = await Promise.all([
        client.readContract({
          address: token0Addr,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [poolAddr],
        }),
        client.readContract({
          address: token1Addr,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [poolAddr],
        }),
        client
          .readContract({
            address: poolAddr,
            abi: ERC20_ABI,
            functionName: "totalSupply",
          })
          .catch(async () => {
            const liq = await client.readContract({
              address: poolAddr,
              abi: UNISWAP_V3_POOL_ABI,
              functionName: "liquidity",
            })
            return BigInt(liq)
          }),
      ])

      const reserve0 = formatUnitsDecimal(rawReserve0, pool.token0.decimals)
      const reserve1 = formatUnitsDecimal(rawReserve1, pool.token1.decimals)
      const totalSupply = formatUnitsDecimal(rawTotalSupply, 18)

      try {
        await workerApiClient.updatePoolState(pool.address, pool.chainId, {
          reserve0,
          reserve1,
          totalSupply,
          isActive: pool.isActive,
        })
      } catch {
        await prisma.pool.update({
          where: { id: pool.id },
          data: { reserve0, reserve1, totalSupply },
        })
      }
    } catch (err) {
      console.warn(
        `[worker:sync-pools] Failed to sync pool ${pool.address} on chain ${pool.chainId}: ${(err as Error).message}`,
      )
    }
  }
}

const syncVaults = async (
  chainId?: number,
  targetAddress?: string,
): Promise<void> => {
  const vaults = await prisma.clVault.findMany({
    where: {
      isActive: true,
      ...(chainId ? { chainId } : {}),
      ...(targetAddress ? { address: targetAddress.toLowerCase() } : {}),
    },
    include: {
      pool: {
        include: {
          token0: true,
          token1: true,
        },
      },
    },
  })

  for (const vault of vaults) {
    const client = getPublicClient(vault.chainId)
    if (!client) continue

    try {
      const vaultAddr = vault.address as Address
      const managerAddr = vault.managerAddress as Address

      const [positionTuple, rawTotalSupply, isPaused] = await Promise.all([
        client.readContract({
          address: vaultAddr,
          abi: KAZE_CL_VAULT_ABI,
          functionName: "position",
        }),
        client.readContract({
          address: vaultAddr,
          abi: KAZE_CL_VAULT_ABI,
          functionName: "totalSupply",
        }),
        client.readContract({
          address: vaultAddr,
          abi: KAZE_CL_VAULT_ABI,
          functionName: "paused",
        }),
      ])

      const [onChainPoolAddress, tickLowerRaw, tickUpperRaw, tokenIdRaw] =
        positionTuple
      const tickLower = Number(tickLowerRaw)
      const tickUpper = Number(tickUpperRaw)
      const tokenIdBigInt = BigInt(tokenIdRaw)
      const poolAddress = (
        onChainPoolAddress &&
        onChainPoolAddress !== "0x0000000000000000000000000000000000000000"
          ? onChainPoolAddress
          : vault.pool.address
      ) as Address

      const slot0 = await client.readContract({
        address: poolAddress,
        abi: UNISWAP_V3_POOL_ABI,
        functionName: "slot0",
      })

      const sqrtPriceX96 = slot0[0]
      const currentTick = Number(slot0[1])

      let positionLiquidity = 0n
      if (tokenIdBigInt > 0n) {
        const nftPosition = await client.readContract({
          address: managerAddr,
          abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
          functionName: "positions",
          args: [tokenIdBigInt],
        })
        positionLiquidity = BigInt(nftPosition[7])
      }

      const sqrtRatioAX96 = getSqrtRatioAtTick(tickLower)
      const sqrtRatioBX96 = getSqrtRatioAtTick(tickUpper)
      const { amount0: rawAmount0, amount1: rawAmount1 } =
        getAmountsForLiquidity(
          sqrtPriceX96,
          sqrtRatioAX96,
          sqrtRatioBX96,
          positionLiquidity,
        )

      const amount0 = formatUnitsDecimal(
        rawAmount0,
        vault.pool.token0.decimals,
      )
      const amount1 = formatUnitsDecimal(
        rawAmount1,
        vault.pool.token1.decimals,
      )
      const liquidity = formatUnitsDecimal(positionLiquidity, 18)
      const totalSupply = formatUnitsDecimal(rawTotalSupply, 18)
      const tokenId = tokenIdBigInt.toString()
      const sqrtPriceX96Str = sqrtPriceX96.toString()

      try {
        await workerApiClient.updateVaultState(vault.address, vault.chainId, {
          tickLower,
          tickUpper,
          currentTick,
          sqrtPriceX96: sqrtPriceX96Str,
          tokenId,
          liquidity,
          amount0,
          amount1,
          totalSupply,
          isPaused,
          isActive: vault.isActive,
        })
      } catch {
        await prisma.clVault.update({
          where: { id: vault.id },
          data: {
            tickLower,
            tickUpper,
            currentTick,
            sqrtPriceX96: sqrtPriceX96Str,
            tokenId,
            liquidity,
            amount0,
            amount1,
            totalSupply,
            isPaused,
          },
        })
      }

      const outOfRange = currentTick < tickLower || currentTick >= tickUpper
      if (outOfRange && ADMIN_ADDRESS) {
        await enqueueNotification({
          walletAddress: ADMIN_ADDRESS,
          chainId: vault.chainId,
          type: "VAULT_REBALANCE",
          title: `Vault Out of Range: ${vault.symbol}`,
          message: `Vault ${vault.name} (${vault.address}) currentTick ${currentTick} is outside [${tickLower}, ${tickUpper}). Rebalance recommended.`,
          txHash: null,
        })
      }
    } catch (err) {
      console.warn(
        `[worker:sync-vaults] Failed to sync vault ${vault.address} on chain ${vault.chainId}: ${(err as Error).message}`,
      )
    }
  }
}

export const processProtocolSyncJob = async (
  job: Job<ProtocolSyncJobPayload>,
): Promise<void> => {
  const { kind, chainId, targetAddress } = job.data

  switch (kind) {
    case "SYNC_PRICES":
      await syncPrices(chainId)
      break
    case "SYNC_POOLS":
      await syncPools(chainId, targetAddress)
      break
    case "SYNC_VAULTS":
      await syncVaults(chainId, targetAddress)
      break
    default:
      throw new Error(`Unsupported ProtocolSyncJobPayload kind: ${String(kind)}`)
  }
}

export const createProtocolSyncWorker = (): Worker<ProtocolSyncJobPayload> => {
  const worker = new Worker<ProtocolSyncJobPayload>(
    QUEUE_NAMES.PROTOCOL_SYNC,
    processProtocolSyncJob,
    {
      connection: createRedisConnection(),
      concurrency: 2,
    },
  )

  worker.on("completed", (job) => {
    console.log(
      `[worker:protocol-sync] Completed ${job.data.kind} (job ${job.id})`,
    )
  })

  worker.on("failed", (job, err) => {
    console.error(
      `[worker:protocol-sync] Failed ${job?.data?.kind ?? "unknown"} (job ${job?.id}): ${err.message}`,
    )
  })

  return worker
}
