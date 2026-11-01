import { parseEventLogs, type Address, type PublicClient } from "viem"
import {
  ERC20_ABI,
  UNISWAP_V3_POOL_ABI,
  formatUnitsDecimal,
} from "../../../../packages/shared/src/index.ts"
import {
  Prisma,
  getIndexerCursor,
  normalizeAddress,
  normalizeTxHash,
  prisma,
  saveIndexerCursor,
  upsertWallet,
} from "../config/db.js"
import {
  MAX_BLOCK_RANGE,
  START_BLOCK_OFFSET,
  getPublicClientForChain,
} from "../config/env.js"
import {
  enqueueNotification,
  enqueueProtocolSync,
} from "../queues/dispatcher.js"

type PoolWithTokens = Prisma.PoolGetPayload<{
  include: {
    token0: true
    token1: true
  }
}>

const absBigInt = (val: bigint): bigint => (val < 0n ? -val : val)

export const refreshPoolOnChainState = async (
  client: PublicClient,
  pool: PoolWithTokens,
): Promise<void> => {
  try {
    const poolAddress = normalizeAddress(pool.address) as Address
    const token0Address = normalizeAddress(pool.token0.address) as Address
    const token1Address = normalizeAddress(pool.token1.address) as Address

    const [rawReserve0, rawReserve1, rawLiquidity, rawErc20Supply] =
      await Promise.all([
        client
          .readContract({
            address: token0Address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [poolAddress],
          })
          .catch(() => null),
        client
          .readContract({
            address: token1Address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [poolAddress],
          })
          .catch(() => null),
        client
          .readContract({
            address: poolAddress,
            abi: UNISWAP_V3_POOL_ABI,
            functionName: "liquidity",
          })
          .catch(() => null),
        client
          .readContract({
            address: poolAddress,
            abi: ERC20_ABI,
            functionName: "totalSupply",
          })
          .catch(() => null),
      ])

    const reserve0Dec =
      rawReserve0 !== null
        ? new Prisma.Decimal(
            formatUnitsDecimal(rawReserve0, pool.token0.decimals),
          )
        : pool.reserve0

    const reserve1Dec =
      rawReserve1 !== null
        ? new Prisma.Decimal(
            formatUnitsDecimal(rawReserve1, pool.token1.decimals),
          )
        : pool.reserve1

    const supplyRaw =
      rawErc20Supply !== null && rawErc20Supply > 0n
        ? rawErc20Supply
        : rawLiquidity !== null
          ? BigInt(rawLiquidity)
          : null

    let totalSupplyDec = pool.totalSupply
    if (supplyRaw !== null && supplyRaw > 0n) {
      totalSupplyDec = new Prisma.Decimal(formatUnitsDecimal(supplyRaw, 18))
    }

    await prisma.pool.update({
      where: { id: pool.id },
      data: {
        reserve0: reserve0Dec,
        reserve1: reserve1Dec,
        totalSupply: totalSupplyDec,
      },
    })
  } catch (err) {
    console.warn(
      `[indexer:pool] Failed to refresh on-chain state for pool ${pool.address} (chain ${pool.chainId}):`,
      err instanceof Error ? err.message : err,
    )
  }
}

export const indexPoolEventsForContract = async (
  client: PublicClient,
  pool: PoolWithTokens,
  latestBlock: bigint,
): Promise<void> => {
  const poolAddress = normalizeAddress(pool.address)
  const cursorBlock = await getIndexerCursor(pool.chainId, poolAddress)

  let fromBlock: bigint
  if (cursorBlock !== null) {
    fromBlock = cursorBlock + 1n
  } else {
    fromBlock =
      latestBlock > START_BLOCK_OFFSET ? latestBlock - START_BLOCK_OFFSET : 0n
  }

  if (fromBlock > latestBlock) {
    return
  }

  const decimals0 = pool.token0.decimals
  const decimals1 = pool.token1.decimals
  const symbol0 = pool.token0.symbol
  const symbol1 = pool.token1.symbol

  let currentFrom = fromBlock
  while (currentFrom <= latestBlock) {
    const currentTo =
      currentFrom + MAX_BLOCK_RANGE - 1n < latestBlock
        ? currentFrom + MAX_BLOCK_RANGE - 1n
        : latestBlock

    const rawLogs = await client.getLogs({
      address: poolAddress as Address,
      fromBlock: currentFrom,
      toBlock: currentTo,
    })

    const parsedLogs = parseEventLogs({
      abi: UNISWAP_V3_POOL_ABI,
      logs: rawLogs,
      strict: false,
    })

    let sawPoolActivity = false

    for (const log of parsedLogs) {
      const txHash = normalizeTxHash(log.transactionHash)

      if (log.eventName === "Swap") {
        const { sender, recipient, amount0, amount1 } = log.args
        if (
          (!recipient && !sender) ||
          amount0 === undefined ||
          amount1 === undefined
        ) {
          continue
        }

        sawPoolActivity = true
        const walletAddress = normalizeAddress(recipient ?? sender!)

        const zeroForOne = amount0 >= 0n
        const tokenIn = zeroForOne ? pool.token0 : pool.token1
        const tokenOut = zeroForOne ? pool.token1 : pool.token0
        const rawAmountIn = zeroForOne ? absBigInt(amount0) : absBigInt(amount1)
        const rawAmountOut = zeroForOne
          ? absBigInt(amount1)
          : absBigInt(amount0)

        const amountInStr = formatUnitsDecimal(rawAmountIn, tokenIn.decimals)
        const amountOutStr = formatUnitsDecimal(rawAmountOut, tokenOut.decimals)

        const amountInDec = new Prisma.Decimal(amountInStr)
        const amountOutDec = new Prisma.Decimal(amountOutStr)

        await prisma.$transaction(async (tx) => {
          const wallet = await upsertWallet(walletAddress, tx)

          if (txHash) {
            await tx.swap.upsert({
              where: {
                chainId_txHash: {
                  chainId: pool.chainId,
                  txHash,
                },
              },
              create: {
                walletId: wallet.id,
                chainId: pool.chainId,
                poolId: pool.id,
                tokenInId: tokenIn.id,
                tokenOutId: tokenOut.id,
                amountIn: amountInDec,
                amountOut: amountOutDec,
                txHash,
                status: "SUCCESS",
              },
              update: {
                walletId: wallet.id,
                poolId: pool.id,
                tokenInId: tokenIn.id,
                tokenOutId: tokenOut.id,
                amountIn: amountInDec,
                amountOut: amountOutDec,
                status: "SUCCESS",
              },
            })
          } else {
            await tx.swap.create({
              data: {
                walletId: wallet.id,
                chainId: pool.chainId,
                poolId: pool.id,
                tokenInId: tokenIn.id,
                tokenOutId: tokenOut.id,
                amountIn: amountInDec,
                amountOut: amountOutDec,
                txHash: null,
                status: "SUCCESS",
              },
            })
          }
        })

        await enqueueNotification({
          walletAddress,
          chainId: pool.chainId,
          type: "SWAP",
          title: `Swapped ${tokenIn.symbol} for ${tokenOut.symbol}`,
          message: `Swapped ${amountInStr} ${tokenIn.symbol} for ${amountOutStr} ${tokenOut.symbol}.`,
          txHash,
        })

        await enqueueProtocolSync({
          kind: "SYNC_POOLS",
          chainId: pool.chainId,
          targetAddress: poolAddress,
        })
      } else if (log.eventName === "Mint") {
        const { sender, owner, amount, amount0, amount1 } = log.args
        if (
          (!owner && !sender) ||
          amount === undefined ||
          amount0 === undefined ||
          amount1 === undefined
        ) {
          continue
        }

        sawPoolActivity = true
        const walletAddress = normalizeAddress(owner ?? sender!)
        const amount0Str = formatUnitsDecimal(amount0, decimals0)
        const amount1Str = formatUnitsDecimal(amount1, decimals1)
        const lpAmountStr = formatUnitsDecimal(BigInt(amount), 18)

        const amount0Dec = new Prisma.Decimal(amount0Str)
        const amount1Dec = new Prisma.Decimal(amount1Str)
        const lpAmountDec = new Prisma.Decimal(lpAmountStr)

        await prisma.$transaction(async (tx) => {
          const wallet = await upsertWallet(walletAddress, tx)

          const existingEvent = txHash
            ? await tx.liquidityEvent.findUnique({
                where: {
                  chainId_txHash: {
                    chainId: pool.chainId,
                    txHash,
                  },
                },
              })
            : null

          const alreadyApplied =
            existingEvent !== null && existingEvent.status === "SUCCESS"

          if (!alreadyApplied) {
            const existingPos = await tx.liquidityPosition.findUnique({
              where: {
                walletId_poolId: {
                  walletId: wallet.id,
                  poolId: pool.id,
                },
              },
            })
            const nextLp = (
              existingPos?.lpTokenAmount ?? new Prisma.Decimal(0)
            ).add(lpAmountDec)

            await tx.liquidityPosition.upsert({
              where: {
                walletId_poolId: {
                  walletId: wallet.id,
                  poolId: pool.id,
                },
              },
              create: {
                walletId: wallet.id,
                poolId: pool.id,
                chainId: pool.chainId,
                lpTokenAmount: lpAmountDec,
              },
              update: {
                lpTokenAmount: nextLp,
              },
            })
          }

          if (txHash) {
            await tx.liquidityEvent.upsert({
              where: {
                chainId_txHash: {
                  chainId: pool.chainId,
                  txHash,
                },
              },
              create: {
                walletId: wallet.id,
                poolId: pool.id,
                chainId: pool.chainId,
                type: "ADD",
                amount0: amount0Dec,
                amount1: amount1Dec,
                lpAmount: lpAmountDec,
                txHash,
                status: "SUCCESS",
              },
              update: {
                walletId: wallet.id,
                poolId: pool.id,
                type: "ADD",
                amount0: amount0Dec,
                amount1: amount1Dec,
                lpAmount: lpAmountDec,
                status: "SUCCESS",
              },
            })
          } else {
            await tx.liquidityEvent.create({
              data: {
                walletId: wallet.id,
                poolId: pool.id,
                chainId: pool.chainId,
                type: "ADD",
                amount0: amount0Dec,
                amount1: amount1Dec,
                lpAmount: lpAmountDec,
                txHash: null,
                status: "SUCCESS",
              },
            })
          }
        })

        await enqueueNotification({
          walletAddress,
          chainId: pool.chainId,
          type: "LIQUIDITY",
          title: `Added Liquidity to ${symbol0}/${symbol1}`,
          message: `Added ${amount0Str} ${symbol0} and ${amount1Str} ${symbol1} (${lpAmountStr} LP).`,
          txHash,
        })
      } else if (log.eventName === "Burn") {
        const { owner, amount, amount0, amount1 } = log.args
        if (
          !owner ||
          amount === undefined ||
          amount0 === undefined ||
          amount1 === undefined
        ) {
          continue
        }

        sawPoolActivity = true
        const walletAddress = normalizeAddress(owner)
        const amount0Str = formatUnitsDecimal(amount0, decimals0)
        const amount1Str = formatUnitsDecimal(amount1, decimals1)
        const lpAmountStr = formatUnitsDecimal(BigInt(amount), 18)

        const amount0Dec = new Prisma.Decimal(amount0Str)
        const amount1Dec = new Prisma.Decimal(amount1Str)
        const lpAmountDec = new Prisma.Decimal(lpAmountStr)

        await prisma.$transaction(async (tx) => {
          const wallet = await upsertWallet(walletAddress, tx)

          const existingEvent = txHash
            ? await tx.liquidityEvent.findUnique({
                where: {
                  chainId_txHash: {
                    chainId: pool.chainId,
                    txHash,
                  },
                },
              })
            : null

          const alreadyApplied =
            existingEvent !== null && existingEvent.status === "SUCCESS"

          if (!alreadyApplied) {
            const existingPos = await tx.liquidityPosition.findUnique({
              where: {
                walletId_poolId: {
                  walletId: wallet.id,
                  poolId: pool.id,
                },
              },
            })
            const currentLp =
              existingPos?.lpTokenAmount ?? new Prisma.Decimal(0)
            const remainingLp = currentLp.sub(lpAmountDec)
            const nextLp = remainingLp.greaterThan(0)
              ? remainingLp
              : new Prisma.Decimal(0)

            await tx.liquidityPosition.upsert({
              where: {
                walletId_poolId: {
                  walletId: wallet.id,
                  poolId: pool.id,
                },
              },
              create: {
                walletId: wallet.id,
                poolId: pool.id,
                chainId: pool.chainId,
                lpTokenAmount: nextLp,
              },
              update: {
                lpTokenAmount: nextLp,
              },
            })
          }

          if (txHash) {
            await tx.liquidityEvent.upsert({
              where: {
                chainId_txHash: {
                  chainId: pool.chainId,
                  txHash,
                },
              },
              create: {
                walletId: wallet.id,
                poolId: pool.id,
                chainId: pool.chainId,
                type: "REMOVE",
                amount0: amount0Dec,
                amount1: amount1Dec,
                lpAmount: lpAmountDec,
                txHash,
                status: "SUCCESS",
              },
              update: {
                walletId: wallet.id,
                poolId: pool.id,
                type: "REMOVE",
                amount0: amount0Dec,
                amount1: amount1Dec,
                lpAmount: lpAmountDec,
                status: "SUCCESS",
              },
            })
          } else {
            await tx.liquidityEvent.create({
              data: {
                walletId: wallet.id,
                poolId: pool.id,
                chainId: pool.chainId,
                type: "REMOVE",
                amount0: amount0Dec,
                amount1: amount1Dec,
                lpAmount: lpAmountDec,
                txHash: null,
                status: "SUCCESS",
              },
            })
          }
        })

        await enqueueNotification({
          walletAddress,
          chainId: pool.chainId,
          type: "LIQUIDITY",
          title: `Removed Liquidity from ${symbol0}/${symbol1}`,
          message: `Removed ${amount0Str} ${symbol0} and ${amount1Str} ${symbol1} (${lpAmountStr} LP).`,
          txHash,
        })
      }
    }

    if (sawPoolActivity) {
      await refreshPoolOnChainState(client, pool)
    }

    await saveIndexerCursor(pool.chainId, poolAddress, currentTo)
    currentFrom = currentTo + 1n
  }
}

export const pollAllPoolEvents = async (): Promise<void> => {
  const pools = await prisma.pool.findMany({
    where: { isActive: true },
    include: {
      token0: true,
      token1: true,
    },
  })

  if (pools.length === 0) return

  const blockByChain = new Map<number, bigint>()

  for (const pool of pools) {
    const client = getPublicClientForChain(pool.chainId)
    if (!client) continue

    try {
      let latestBlock = blockByChain.get(pool.chainId)
      if (latestBlock === undefined) {
        latestBlock = await client.getBlockNumber()
        blockByChain.set(pool.chainId, latestBlock)
      }
      await indexPoolEventsForContract(client, pool, latestBlock)
    } catch (err) {
      console.error(
        `[indexer:pool] Error indexing pool ${pool.address} on chain ${pool.chainId}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
}

export const syncAllPoolStates = async (): Promise<void> => {
  const pools = await prisma.pool.findMany({
    where: { isActive: true },
    include: {
      token0: true,
      token1: true,
    },
  })

  for (const pool of pools) {
    const client = getPublicClientForChain(pool.chainId)
    if (!client) continue

    await refreshPoolOnChainState(client, pool)
  }
}
