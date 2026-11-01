import { parseEventLogs, type Address, type Hex, type PublicClient } from "viem"
import {
  KAZE_CL_VAULT_ABI,
  NONFUNGIBLE_POSITION_MANAGER_ABI,
  UNISWAP_V3_POOL_ABI,
  formatUnitsDecimal,
  getAmountsForLiquidity,
  getSqrtRatioAtTick,
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
  ADMIN_ADDRESS,
  MAX_BLOCK_RANGE,
  START_BLOCK_OFFSET,
  getPublicClientForChain,
} from "../config/env.js"
import { enqueueNotification } from "../queues/dispatcher.js"

type VaultWithPool = Prisma.ClVaultGetPayload<{
  include: {
    pool: {
      include: {
        token0: true
        token1: true
      }
    }
  }
}>

const resolveTxSender = async (
  client: PublicClient,
  txHash: string | null,
  fallbackAddress: string,
): Promise<string> => {
  if (txHash) {
    try {
      const tx = await client.getTransaction({ hash: txHash as Hex })
      if (tx?.from) {
        return normalizeAddress(tx.from)
      }
    } catch {
      // Fallback when RPC transaction lookup is unavailable
    }
  }
  if (ADMIN_ADDRESS.length > 0) return ADMIN_ADDRESS
  return normalizeAddress(fallbackAddress)
}

export const refreshVaultOnChainState = async (
  client: PublicClient,
  vault: VaultWithPool,
  overrideTicks?: { tickLower: number; tickUpper: number },
): Promise<void> => {
  try {
    const vaultAddress = normalizeAddress(vault.address) as Address
    const managerAddress = normalizeAddress(vault.managerAddress) as Address

    const [positionTuple, totalSupplyRaw, isPausedRaw] = await Promise.all([
      client.readContract({
        address: vaultAddress,
        abi: KAZE_CL_VAULT_ABI,
        functionName: "position",
      }),
      client.readContract({
        address: vaultAddress,
        abi: KAZE_CL_VAULT_ABI,
        functionName: "totalSupply",
      }),
      client
        .readContract({
          address: vaultAddress,
          abi: KAZE_CL_VAULT_ABI,
          functionName: "paused",
        })
        .catch(() => vault.isPaused),
    ])

    const [onChainPoolAddr, rawTickLower, rawTickUpper, rawTokenId] = positionTuple
    const poolAddress = (
      onChainPoolAddr &&
      onChainPoolAddr !== "0x0000000000000000000000000000000000000000"
        ? normalizeAddress(onChainPoolAddr)
        : normalizeAddress(vault.pool.address)
    ) as Address

    const slot0Tuple = await client.readContract({
      address: poolAddress,
      abi: UNISWAP_V3_POOL_ABI,
      functionName: "slot0",
    })

    const sqrtPriceX96 = slot0Tuple[0]
    const currentTick = Number(slot0Tuple[1])
    const tokenIdBigInt = BigInt(rawTokenId)

    let liquidityRaw = 0n
    if (tokenIdBigInt > 0n) {
      const positionData = await client.readContract({
        address: managerAddress,
        abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
        functionName: "positions",
        args: [tokenIdBigInt],
      })
      liquidityRaw = BigInt(positionData[7])
    }

    const candidateTickLower =
      overrideTicks?.tickLower ?? Number(rawTickLower)
    const candidateTickUpper =
      overrideTicks?.tickUpper ?? Number(rawTickUpper)

    const tickLower =
      candidateTickLower < candidateTickUpper
        ? candidateTickLower
        : vault.tickLower
    const tickUpper =
      candidateTickLower < candidateTickUpper
        ? candidateTickUpper
        : vault.tickUpper

    const sqrtRatioAX96 = getSqrtRatioAtTick(tickLower)
    const sqrtRatioBX96 = getSqrtRatioAtTick(tickUpper)
    const { amount0: rawAmount0, amount1: rawAmount1 } = getAmountsForLiquidity(
      sqrtPriceX96,
      sqrtRatioAX96,
      sqrtRatioBX96,
      liquidityRaw,
    )

    const decimals0 = vault.pool.token0.decimals
    const decimals1 = vault.pool.token1.decimals

    const amount0Dec = new Prisma.Decimal(
      formatUnitsDecimal(rawAmount0, decimals0),
    )
    const amount1Dec = new Prisma.Decimal(
      formatUnitsDecimal(rawAmount1, decimals1),
    )
    const liquidityDec = new Prisma.Decimal(
      formatUnitsDecimal(liquidityRaw, 18),
    )
    const totalSupplyDec = new Prisma.Decimal(
      formatUnitsDecimal(totalSupplyRaw, 18),
    )

    await prisma.clVault.update({
      where: { id: vault.id },
      data: {
        tickLower,
        tickUpper,
        tokenId: tokenIdBigInt.toString(),
        liquidity: liquidityDec,
        amount0: amount0Dec,
        amount1: amount1Dec,
        totalSupply: totalSupplyDec,
        sqrtPriceX96: sqrtPriceX96.toString(),
        currentTick,
        isPaused: Boolean(isPausedRaw),
      },
    })
  } catch (err) {
    console.warn(
      `[indexer:vault] Failed to refresh on-chain state for vault ${vault.address} (chain ${vault.chainId}):`,
      err instanceof Error ? err.message : err,
    )
  }
}

export const indexVaultEventsForContract = async (
  client: PublicClient,
  vault: VaultWithPool,
  latestBlock: bigint,
): Promise<void> => {
  const vaultAddress = normalizeAddress(vault.address)
  const cursorBlock = await getIndexerCursor(vault.chainId, vaultAddress)

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

  const decimals0 = vault.pool.token0.decimals
  const decimals1 = vault.pool.token1.decimals
  const symbol0 = vault.pool.token0.symbol
  const symbol1 = vault.pool.token1.symbol

  let currentFrom = fromBlock
  while (currentFrom <= latestBlock) {
    const currentTo =
      currentFrom + MAX_BLOCK_RANGE - 1n < latestBlock
        ? currentFrom + MAX_BLOCK_RANGE - 1n
        : latestBlock

    const rawLogs = await client.getLogs({
      address: vaultAddress as Address,
      fromBlock: currentFrom,
      toBlock: currentTo,
    })

    const parsedLogs = parseEventLogs({
      abi: KAZE_CL_VAULT_ABI,
      logs: rawLogs,
      strict: false,
    })

    for (const log of parsedLogs) {
      const txHash = normalizeTxHash(log.transactionHash)

      if (log.eventName === "Deposit") {
        const { sender, amount0Used, amount1Used, shares, receiver } = log.args
        if (
          !receiver ||
          amount0Used === undefined ||
          amount1Used === undefined ||
          shares === undefined
        ) {
          continue
        }

        const receiverAddress = normalizeAddress(receiver)
        const amount0Str = formatUnitsDecimal(amount0Used, decimals0)
        const amount1Str = formatUnitsDecimal(amount1Used, decimals1)
        const sharesStr = formatUnitsDecimal(shares, 18)

        const amount0Dec = new Prisma.Decimal(amount0Str)
        const amount1Dec = new Prisma.Decimal(amount1Str)
        const sharesDec = new Prisma.Decimal(sharesStr)

        await prisma.$transaction(async (tx) => {
          const wallet = await upsertWallet(receiverAddress, tx)

          const existingEvent = txHash
            ? await tx.vaultEvent.findUnique({
                where: {
                  chainId_txHash: {
                    chainId: vault.chainId,
                    txHash,
                  },
                },
              })
            : null

          const alreadyAppliedDeposit =
            existingEvent !== null &&
            existingEvent.status === "SUCCESS" &&
            existingEvent.type === "DEPOSIT"

          if (!alreadyAppliedDeposit) {
            const existingPosition = await tx.vaultPosition.findUnique({
              where: {
                walletId_vaultId: {
                  walletId: wallet.id,
                  vaultId: vault.id,
                },
              },
            })
            const nextShares = (
              existingPosition?.shares ?? new Prisma.Decimal(0)
            ).add(sharesDec)

            await tx.vaultPosition.upsert({
              where: {
                walletId_vaultId: {
                  walletId: wallet.id,
                  vaultId: vault.id,
                },
              },
              create: {
                walletId: wallet.id,
                vaultId: vault.id,
                chainId: vault.chainId,
                shares: sharesDec,
              },
              update: {
                shares: nextShares,
              },
            })
          }

          if (txHash) {
            await tx.vaultEvent.upsert({
              where: {
                chainId_txHash: {
                  chainId: vault.chainId,
                  txHash,
                },
              },
              create: {
                walletId: wallet.id,
                vaultId: vault.id,
                chainId: vault.chainId,
                type: "DEPOSIT",
                amount0: amount0Dec,
                amount1: amount1Dec,
                shares: sharesDec,
                txHash,
                status: "SUCCESS",
              },
              update: {
                walletId: wallet.id,
                vaultId: vault.id,
                type: "DEPOSIT",
                amount0: amount0Dec,
                amount1: amount1Dec,
                shares: sharesDec,
                status: "SUCCESS",
              },
            })
          } else {
            await tx.vaultEvent.create({
              data: {
                walletId: wallet.id,
                vaultId: vault.id,
                chainId: vault.chainId,
                type: "DEPOSIT",
                amount0: amount0Dec,
                amount1: amount1Dec,
                shares: sharesDec,
                txHash: null,
                status: "SUCCESS",
              },
            })
          }
        })

        await refreshVaultOnChainState(client, vault)

        await enqueueNotification({
          walletAddress: receiverAddress,
          chainId: vault.chainId,
          type: "VAULT_DEPOSIT",
          title: `Deposited into ${vault.symbol}`,
          message: `Deposited ${amount0Str} ${symbol0} and ${amount1Str} ${symbol1} for ${sharesStr} ${vault.symbol} shares${sender ? ` (from ${normalizeAddress(sender)})` : ""}.`,
          txHash,
        })
      } else if (log.eventName === "Withdraw") {
        const {
          sender,
          amount0Withdraw,
          amount1Withdraw,
          liquidity,
          receiver,
        } = log.args
        if (
          !sender ||
          amount0Withdraw === undefined ||
          amount1Withdraw === undefined ||
          liquidity === undefined
        ) {
          continue
        }

        const senderAddress = normalizeAddress(sender)
        const amount0Str = formatUnitsDecimal(amount0Withdraw, decimals0)
        const amount1Str = formatUnitsDecimal(amount1Withdraw, decimals1)
        const liquidityStr = formatUnitsDecimal(liquidity, 18)

        const amount0Dec = new Prisma.Decimal(amount0Str)
        const amount1Dec = new Prisma.Decimal(amount1Str)
        const liquidityDec = new Prisma.Decimal(liquidityStr)

        let onChainSharesDec: Prisma.Decimal | null = null
        try {
          const rawBalance = await client.readContract({
            address: vaultAddress as Address,
            abi: KAZE_CL_VAULT_ABI,
            functionName: "balanceOf",
            args: [senderAddress as Address],
          })
          onChainSharesDec = new Prisma.Decimal(
            formatUnitsDecimal(rawBalance, 18),
          )
        } catch {
          onChainSharesDec = null
        }

        await prisma.$transaction(async (tx) => {
          const wallet = await upsertWallet(senderAddress, tx)

          const existingEvent = txHash
            ? await tx.vaultEvent.findUnique({
                where: {
                  chainId_txHash: {
                    chainId: vault.chainId,
                    txHash,
                  },
                },
              })
            : null

          const alreadyAppliedWithdraw =
            existingEvent !== null &&
            existingEvent.status === "SUCCESS" &&
            existingEvent.type === "WITHDRAW"

          const existingPosition = await tx.vaultPosition.findUnique({
            where: {
              walletId_vaultId: {
                walletId: wallet.id,
                vaultId: vault.id,
              },
            },
          })

          let nextShares: Prisma.Decimal
          if (onChainSharesDec !== null) {
            nextShares = onChainSharesDec
          } else if (!alreadyAppliedWithdraw) {
            const currentShares =
              existingPosition?.shares ?? new Prisma.Decimal(0)
            const decremented = currentShares.sub(liquidityDec)
            nextShares = decremented.greaterThan(0)
              ? decremented
              : new Prisma.Decimal(0)
          } else {
            nextShares = existingPosition?.shares ?? new Prisma.Decimal(0)
          }

          await tx.vaultPosition.upsert({
            where: {
              walletId_vaultId: {
                walletId: wallet.id,
                vaultId: vault.id,
              },
            },
            create: {
              walletId: wallet.id,
              vaultId: vault.id,
              chainId: vault.chainId,
              shares: nextShares,
            },
            update: {
              shares: nextShares,
            },
          })

          if (txHash) {
            await tx.vaultEvent.upsert({
              where: {
                chainId_txHash: {
                  chainId: vault.chainId,
                  txHash,
                },
              },
              create: {
                walletId: wallet.id,
                vaultId: vault.id,
                chainId: vault.chainId,
                type: "WITHDRAW",
                amount0: amount0Dec,
                amount1: amount1Dec,
                liquidity: liquidityDec,
                txHash,
                status: "SUCCESS",
              },
              update: {
                walletId: wallet.id,
                vaultId: vault.id,
                type: "WITHDRAW",
                amount0: amount0Dec,
                amount1: amount1Dec,
                liquidity: liquidityDec,
                status: "SUCCESS",
              },
            })
          } else {
            await tx.vaultEvent.create({
              data: {
                walletId: wallet.id,
                vaultId: vault.id,
                chainId: vault.chainId,
                type: "WITHDRAW",
                amount0: amount0Dec,
                amount1: amount1Dec,
                liquidity: liquidityDec,
                txHash: null,
                status: "SUCCESS",
              },
            })
          }
        })

        await refreshVaultOnChainState(client, vault)

        await enqueueNotification({
          walletAddress: senderAddress,
          chainId: vault.chainId,
          type: "VAULT_WITHDRAW",
          title: `Withdrew from ${vault.symbol}`,
          message: `Withdrew ${amount0Str} ${symbol0} and ${amount1Str} ${symbol1} from ${vault.name}${receiver ? ` to ${normalizeAddress(receiver)}` : ""}.`,
          txHash,
        })
      } else if (log.eventName === "HandleFees") {
        const { liquidityAdded, amount0Used, amount1Used } = log.args
        if (
          liquidityAdded === undefined ||
          amount0Used === undefined ||
          amount1Used === undefined
        ) {
          continue
        }

        const callerAddress = await resolveTxSender(
          client,
          txHash,
          vault.managerAddress,
        )
        const amount0Str = formatUnitsDecimal(amount0Used, decimals0)
        const amount1Str = formatUnitsDecimal(amount1Used, decimals1)
        const liquidityStr = formatUnitsDecimal(liquidityAdded, 18)

        const amount0Dec = new Prisma.Decimal(amount0Str)
        const amount1Dec = new Prisma.Decimal(amount1Str)
        const liquidityDec = new Prisma.Decimal(liquidityStr)

        await prisma.$transaction(async (tx) => {
          const wallet = await upsertWallet(callerAddress, tx)

          if (txHash) {
            const existing = await tx.vaultEvent.findUnique({
              where: {
                chainId_txHash: {
                  chainId: vault.chainId,
                  txHash,
                },
              },
            })
            if (existing && existing.type !== "HANDLE_FEES") {
              return
            }

            await tx.vaultEvent.upsert({
              where: {
                chainId_txHash: {
                  chainId: vault.chainId,
                  txHash,
                },
              },
              create: {
                walletId: wallet.id,
                vaultId: vault.id,
                chainId: vault.chainId,
                type: "HANDLE_FEES",
                amount0: amount0Dec,
                amount1: amount1Dec,
                liquidity: liquidityDec,
                txHash,
                status: "SUCCESS",
              },
              update: {
                walletId: wallet.id,
                vaultId: vault.id,
                type: "HANDLE_FEES",
                amount0: amount0Dec,
                amount1: amount1Dec,
                liquidity: liquidityDec,
                status: "SUCCESS",
              },
            })
          } else {
            await tx.vaultEvent.create({
              data: {
                walletId: wallet.id,
                vaultId: vault.id,
                chainId: vault.chainId,
                type: "HANDLE_FEES",
                amount0: amount0Dec,
                amount1: amount1Dec,
                liquidity: liquidityDec,
                txHash: null,
                status: "SUCCESS",
              },
            })
          }
        })

        await refreshVaultOnChainState(client, vault)

        await enqueueNotification({
          walletAddress: callerAddress,
          chainId: vault.chainId,
          type: "VAULT_FEES",
          title: `${vault.symbol} Fees Compounded`,
          message: `Compounded ${amount0Str} ${symbol0} and ${amount1Str} ${symbol1} into ${liquidityStr} liquidity.`,
          txHash,
        })
      } else if (log.eventName === "Rebalance") {
        const {
          old_lower_tick,
          old_upper_tick,
          new_lower_tick,
          new_upper_tick,
          new_liquidity,
          amount0_used,
          amount1_used,
        } = log.args
        if (
          old_lower_tick === undefined ||
          old_upper_tick === undefined ||
          new_lower_tick === undefined ||
          new_upper_tick === undefined ||
          new_liquidity === undefined ||
          amount0_used === undefined ||
          amount1_used === undefined
        ) {
          continue
        }

        const callerAddress = await resolveTxSender(
          client,
          txHash,
          vault.managerAddress,
        )
        const oldTickLower = Number(old_lower_tick)
        const oldTickUpper = Number(old_upper_tick)
        const newTickLower = Number(new_lower_tick)
        const newTickUpper = Number(new_upper_tick)

        const amount0Str = formatUnitsDecimal(amount0_used, decimals0)
        const amount1Str = formatUnitsDecimal(amount1_used, decimals1)
        const liquidityStr = formatUnitsDecimal(new_liquidity, 18)

        const amount0Dec = new Prisma.Decimal(amount0Str)
        const amount1Dec = new Prisma.Decimal(amount1Str)
        const liquidityDec = new Prisma.Decimal(liquidityStr)

        await prisma.$transaction(async (tx) => {
          const wallet = await upsertWallet(callerAddress, tx)

          if (txHash) {
            await tx.vaultEvent.upsert({
              where: {
                chainId_txHash: {
                  chainId: vault.chainId,
                  txHash,
                },
              },
              create: {
                walletId: wallet.id,
                vaultId: vault.id,
                chainId: vault.chainId,
                type: "REBALANCE",
                amount0: amount0Dec,
                amount1: amount1Dec,
                liquidity: liquidityDec,
                oldTickLower,
                oldTickUpper,
                newTickLower,
                newTickUpper,
                txHash,
                status: "SUCCESS",
              },
              update: {
                walletId: wallet.id,
                vaultId: vault.id,
                type: "REBALANCE",
                amount0: amount0Dec,
                amount1: amount1Dec,
                liquidity: liquidityDec,
                oldTickLower,
                oldTickUpper,
                newTickLower,
                newTickUpper,
                status: "SUCCESS",
              },
            })
          } else {
            await tx.vaultEvent.create({
              data: {
                walletId: wallet.id,
                vaultId: vault.id,
                chainId: vault.chainId,
                type: "REBALANCE",
                amount0: amount0Dec,
                amount1: amount1Dec,
                liquidity: liquidityDec,
                oldTickLower,
                oldTickUpper,
                newTickLower,
                newTickUpper,
                txHash: null,
                status: "SUCCESS",
              },
            })
          }
        })

        await refreshVaultOnChainState(client, vault, {
          tickLower: newTickLower,
          tickUpper: newTickUpper,
        })

        await enqueueNotification({
          walletAddress: callerAddress,
          chainId: vault.chainId,
          type: "VAULT_REBALANCE",
          title: `${vault.symbol} Vault Rebalanced`,
          message: `Rebalanced tick range from [${oldTickLower}, ${oldTickUpper}] to [${newTickLower}, ${newTickUpper}] with ${liquidityStr} liquidity.`,
          txHash,
        })
      }
    }

    await saveIndexerCursor(vault.chainId, vaultAddress, currentTo)
    currentFrom = currentTo + 1n
  }
}

export const pollAllVaultEvents = async (): Promise<void> => {
  const vaults = await prisma.clVault.findMany({
    where: { isActive: true },
    include: {
      pool: {
        include: {
          token0: true,
          token1: true,
        },
      },
    },
  })

  if (vaults.length === 0) return

  const blockByChain = new Map<number, bigint>()

  for (const vault of vaults) {
    const client = getPublicClientForChain(vault.chainId)
    if (!client) continue

    try {
      let latestBlock = blockByChain.get(vault.chainId)
      if (latestBlock === undefined) {
        latestBlock = await client.getBlockNumber()
        blockByChain.set(vault.chainId, latestBlock)
      }
      await indexVaultEventsForContract(client, vault, latestBlock)
    } catch (err) {
      console.error(
        `[indexer:vault] Error indexing vault ${vault.address} on chain ${vault.chainId}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
}

export const syncAllVaultStates = async (): Promise<void> => {
  const vaults = await prisma.clVault.findMany({
    where: { isActive: true },
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
    const client = getPublicClientForChain(vault.chainId)
    if (!client) continue

    await refreshVaultOnChainState(client, vault)
  }
}
