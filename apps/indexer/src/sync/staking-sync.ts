import { parseEventLogs, type Address, type PublicClient } from "viem"
import {
  STAKING_FARM_ABI,
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
  enqueueRewardCalculation,
} from "../queues/dispatcher.js"

type FarmWithRelations = Prisma.StakingFarmGetPayload<{
  include: {
    pool: {
      include: {
        token0: true
        token1: true
      }
    }
    rewardToken: true
  }
}>

export const indexStakingEventsForContract = async (
  client: PublicClient,
  farm: FarmWithRelations,
  latestBlock: bigint,
): Promise<void> => {
  const farmAddress = normalizeAddress(farm.address)
  const cursorBlock = await getIndexerCursor(farm.chainId, farmAddress)

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

  const pairSymbol = `${farm.pool.token0.symbol}/${farm.pool.token1.symbol}`
  const rewardDecimals = farm.rewardToken.decimals
  const rewardSymbol = farm.rewardToken.symbol

  let currentFrom = fromBlock
  while (currentFrom <= latestBlock) {
    const currentTo =
      currentFrom + MAX_BLOCK_RANGE - 1n < latestBlock
        ? currentFrom + MAX_BLOCK_RANGE - 1n
        : latestBlock

    const rawLogs = await client.getLogs({
      address: farmAddress as Address,
      fromBlock: currentFrom,
      toBlock: currentTo,
    })

    const parsedLogs = parseEventLogs({
      abi: STAKING_FARM_ABI,
      logs: rawLogs,
      strict: false,
    })

    for (const log of parsedLogs) {
      const txHash = normalizeTxHash(log.transactionHash)

      if (log.eventName === "Staked") {
        const { user, amount } = log.args
        if (!user || amount === undefined) continue

        const walletAddress = normalizeAddress(user)
        const amountStr = formatUnitsDecimal(amount, 18)
        const amountDec = new Prisma.Decimal(amountStr)

        await prisma.$transaction(async (tx) => {
          const wallet = await upsertWallet(walletAddress, tx)

          const existingEvent = txHash
            ? await tx.stakingEvent.findUnique({
                where: {
                  chainId_txHash: {
                    chainId: farm.chainId,
                    txHash,
                  },
                },
              })
            : null

          const alreadyApplied =
            existingEvent !== null && existingEvent.status === "SUCCESS"

          if (!alreadyApplied) {
            const existingStakingPos = await tx.stakingPosition.findUnique({
              where: {
                walletId_farmId: {
                  walletId: wallet.id,
                  farmId: farm.id,
                },
              },
            })
            const nextStaked = (
              existingStakingPos?.stakedAmount ?? new Prisma.Decimal(0)
            ).add(amountDec)

            await tx.stakingPosition.upsert({
              where: {
                walletId_farmId: {
                  walletId: wallet.id,
                  farmId: farm.id,
                },
              },
              create: {
                walletId: wallet.id,
                farmId: farm.id,
                chainId: farm.chainId,
                stakedAmount: amountDec,
              },
              update: {
                stakedAmount: nextStaked,
              },
            })

            const existingLpPos = await tx.liquidityPosition.findUnique({
              where: {
                walletId_poolId: {
                  walletId: wallet.id,
                  poolId: farm.poolId,
                },
              },
            })
            if (existingLpPos) {
              const remainingLp = existingLpPos.lpTokenAmount.sub(amountDec)
              const nextLp = remainingLp.greaterThan(0)
                ? remainingLp
                : new Prisma.Decimal(0)

              await tx.liquidityPosition.update({
                where: {
                  walletId_poolId: {
                    walletId: wallet.id,
                    poolId: farm.poolId,
                  },
                },
                data: {
                  lpTokenAmount: nextLp,
                },
              })
            }
          }

          if (txHash) {
            await tx.stakingEvent.upsert({
              where: {
                chainId_txHash: {
                  chainId: farm.chainId,
                  txHash,
                },
              },
              create: {
                walletId: wallet.id,
                farmId: farm.id,
                chainId: farm.chainId,
                type: "STAKE",
                amount: amountDec,
                txHash,
                status: "SUCCESS",
              },
              update: {
                walletId: wallet.id,
                farmId: farm.id,
                type: "STAKE",
                amount: amountDec,
                status: "SUCCESS",
              },
            })
          } else {
            await tx.stakingEvent.create({
              data: {
                walletId: wallet.id,
                farmId: farm.id,
                chainId: farm.chainId,
                type: "STAKE",
                amount: amountDec,
                txHash: null,
                status: "SUCCESS",
              },
            })
          }
        })

        await enqueueNotification({
          walletAddress,
          chainId: farm.chainId,
          type: "STAKING",
          title: `Staked ${pairSymbol} LP`,
          message: `Staked ${amountStr} ${pairSymbol} LP tokens into farm ${farmAddress}.`,
          txHash,
        })

        await enqueueRewardCalculation({
          chainId: farm.chainId,
          farmAddress,
          walletAddress,
          txHash,
        })
      } else if (log.eventName === "Unstaked") {
        const { user, amount } = log.args
        if (!user || amount === undefined) continue

        const walletAddress = normalizeAddress(user)
        const amountStr = formatUnitsDecimal(amount, 18)
        const amountDec = new Prisma.Decimal(amountStr)

        await prisma.$transaction(async (tx) => {
          const wallet = await upsertWallet(walletAddress, tx)

          const existingEvent = txHash
            ? await tx.stakingEvent.findUnique({
                where: {
                  chainId_txHash: {
                    chainId: farm.chainId,
                    txHash,
                  },
                },
              })
            : null

          const alreadyApplied =
            existingEvent !== null && existingEvent.status === "SUCCESS"

          if (!alreadyApplied) {
            const existingStakingPos = await tx.stakingPosition.findUnique({
              where: {
                walletId_farmId: {
                  walletId: wallet.id,
                  farmId: farm.id,
                },
              },
            })
            const currentStaked =
              existingStakingPos?.stakedAmount ?? new Prisma.Decimal(0)
            const remainingStaked = currentStaked.sub(amountDec)
            const nextStaked = remainingStaked.greaterThan(0)
              ? remainingStaked
              : new Prisma.Decimal(0)

            await tx.stakingPosition.upsert({
              where: {
                walletId_farmId: {
                  walletId: wallet.id,
                  farmId: farm.id,
                },
              },
              create: {
                walletId: wallet.id,
                farmId: farm.id,
                chainId: farm.chainId,
                stakedAmount: nextStaked,
              },
              update: {
                stakedAmount: nextStaked,
              },
            })

            const existingLpPos = await tx.liquidityPosition.findUnique({
              where: {
                walletId_poolId: {
                  walletId: wallet.id,
                  poolId: farm.poolId,
                },
              },
            })
            const nextLp = (
              existingLpPos?.lpTokenAmount ?? new Prisma.Decimal(0)
            ).add(amountDec)

            await tx.liquidityPosition.upsert({
              where: {
                walletId_poolId: {
                  walletId: wallet.id,
                  poolId: farm.poolId,
                },
              },
              create: {
                walletId: wallet.id,
                poolId: farm.poolId,
                chainId: farm.chainId,
                lpTokenAmount: nextLp,
              },
              update: {
                lpTokenAmount: nextLp,
              },
            })
          }

          if (txHash) {
            await tx.stakingEvent.upsert({
              where: {
                chainId_txHash: {
                  chainId: farm.chainId,
                  txHash,
                },
              },
              create: {
                walletId: wallet.id,
                farmId: farm.id,
                chainId: farm.chainId,
                type: "UNSTAKE",
                amount: amountDec,
                txHash,
                status: "SUCCESS",
              },
              update: {
                walletId: wallet.id,
                farmId: farm.id,
                type: "UNSTAKE",
                amount: amountDec,
                status: "SUCCESS",
              },
            })
          } else {
            await tx.stakingEvent.create({
              data: {
                walletId: wallet.id,
                farmId: farm.id,
                chainId: farm.chainId,
                type: "UNSTAKE",
                amount: amountDec,
                txHash: null,
                status: "SUCCESS",
              },
            })
          }
        })

        await enqueueNotification({
          walletAddress,
          chainId: farm.chainId,
          type: "STAKING",
          title: `Unstaked ${pairSymbol} LP`,
          message: `Unstaked ${amountStr} ${pairSymbol} LP tokens from farm ${farmAddress}.`,
          txHash,
        })
      } else if (log.eventName === "RewardPaid") {
        const { user, reward } = log.args
        if (!user || reward === undefined) continue

        const walletAddress = normalizeAddress(user)
        const rewardStr = formatUnitsDecimal(reward, rewardDecimals)
        const rewardDec = new Prisma.Decimal(rewardStr)

        await prisma.$transaction(async (tx) => {
          const wallet = await upsertWallet(walletAddress, tx)

          if (txHash) {
            await tx.stakingEvent.upsert({
              where: {
                chainId_txHash: {
                  chainId: farm.chainId,
                  txHash,
                },
              },
              create: {
                walletId: wallet.id,
                farmId: farm.id,
                chainId: farm.chainId,
                type: "CLAIM",
                amount: rewardDec,
                txHash,
                status: "SUCCESS",
              },
              update: {
                walletId: wallet.id,
                farmId: farm.id,
                type: "CLAIM",
                amount: rewardDec,
                status: "SUCCESS",
              },
            })
          } else {
            await tx.stakingEvent.create({
              data: {
                walletId: wallet.id,
                farmId: farm.id,
                chainId: farm.chainId,
                type: "CLAIM",
                amount: rewardDec,
                txHash: null,
                status: "SUCCESS",
              },
            })
          }
        })

        await enqueueNotification({
          walletAddress,
          chainId: farm.chainId,
          type: "REWARD",
          title: `Claimed ${rewardSymbol} Rewards`,
          message: `Claimed ${rewardStr} ${rewardSymbol} rewards from ${pairSymbol} staking farm.`,
          txHash,
        })
      }
    }

    await saveIndexerCursor(farm.chainId, farmAddress, currentTo)
    currentFrom = currentTo + 1n
  }
}

export const pollAllStakingEvents = async (): Promise<void> => {
  const farms = await prisma.stakingFarm.findMany({
    where: { isActive: true },
    include: {
      pool: {
        include: {
          token0: true,
          token1: true,
        },
      },
      rewardToken: true,
    },
  })

  if (farms.length === 0) return

  const blockByChain = new Map<number, bigint>()

  for (const farm of farms) {
    const client = getPublicClientForChain(farm.chainId)
    if (!client) continue

    try {
      let latestBlock = blockByChain.get(farm.chainId)
      if (latestBlock === undefined) {
        latestBlock = await client.getBlockNumber()
        blockByChain.set(farm.chainId, latestBlock)
      }
      await indexStakingEventsForContract(client, farm, latestBlock)
    } catch (err) {
      console.error(
        `[indexer:staking] Error indexing farm ${farm.address} on chain ${farm.chainId}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
}
