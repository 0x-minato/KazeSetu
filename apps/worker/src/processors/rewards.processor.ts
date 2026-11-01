import { Queue, Worker, type Job } from "bullmq"
import { createPublicClient, http, type Address, type PublicClient } from "viem"
import {
  QUEUE_NAMES,
  STAKING_FARM_ABI,
  formatUnitsDecimal,
  type RewardCalcJobPayload,
} from "../../../../packages/shared/src/index.ts"
import { getRpcUrlForChain } from "../config/env.js"
import { createRedisConnection } from "../config/redis.js"
import { prisma } from "../config/db.js"
import { enqueueNotification } from "./notification.processor.js"

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

export const rewardsQueue = new Queue<RewardCalcJobPayload>(
  QUEUE_NAMES.REWARDS,
  {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2_500,
      },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  },
)

export const processRewardCalcJob = async (
  job: Job<RewardCalcJobPayload>,
): Promise<void> => {
  const { chainId, farmAddress, walletAddress, txHash } = job.data

  const positions = await prisma.stakingPosition.findMany({
    where: {
      chainId,
      stakedAmount: { gt: 0 },
      ...(walletAddress
        ? { wallet: { address: walletAddress.toLowerCase() } }
        : {}),
      ...(farmAddress
        ? { farm: { address: farmAddress.toLowerCase(), isActive: true } }
        : { farm: { isActive: true } }),
    },
    include: {
      wallet: true,
      farm: {
        include: {
          rewardToken: true,
          pool: {
            include: {
              token0: true,
              token1: true,
            },
          },
        },
      },
    },
  })

  if (positions.length === 0) return

  const client = getPublicClient(chainId)

  for (const position of positions) {
    let earnedFormatted: string | null = null

    if (client) {
      try {
        const rawEarned = await client.readContract({
          address: position.farm.address as Address,
          abi: STAKING_FARM_ABI,
          functionName: "earned",
          args: [position.wallet.address as Address],
        })

        if (rawEarned > 0n) {
          earnedFormatted = formatUnitsDecimal(
            rawEarned,
            position.farm.rewardToken.decimals,
          )
        }
      } catch (err) {
        console.warn(
          `[worker:rewards] On-chain earned() read failed for ${position.wallet.address} on farm ${position.farm.address}: ${(err as Error).message}`,
        )
      }
    }

    if (!earnedFormatted) {
      const stakedStr = position.stakedAmount.toString()
      const stakedNum = Number(stakedStr)
      if (!Number.isFinite(stakedNum) || stakedNum <= 0) continue
      const estimatedReward = (stakedNum * 0.001).toFixed(6).replace(/\.?0+$/, "")
      if (!estimatedReward || estimatedReward === "0") continue
      earnedFormatted = estimatedReward
    }

    const pairLabel = `${position.farm.pool.token0.symbol}/${position.farm.pool.token1.symbol}`
    const rewardSymbol = position.farm.rewardToken.symbol

    await enqueueNotification({
      walletAddress: position.wallet.address,
      chainId,
      type: "REWARD",
      title: `Staking Rewards Available (${pairLabel})`,
      message: `You have ${earnedFormatted} ${rewardSymbol} in accrued staking rewards on the ${pairLabel} farm.`,
      txHash: txHash ?? null,
    })
  }
}

export const createRewardsWorker = (): Worker<RewardCalcJobPayload> => {
  const worker = new Worker<RewardCalcJobPayload>(
    QUEUE_NAMES.REWARDS,
    processRewardCalcJob,
    {
      connection: createRedisConnection(),
      concurrency: 3,
    },
  )

  worker.on("completed", (job) => {
    console.log(
      `[worker:rewards] Completed reward calculation job ${job.id} (chain ${job.data.chainId})`,
    )
  })

  worker.on("failed", (job, err) => {
    console.error(
      `[worker:rewards] Failed reward calculation job ${job?.id}: ${err.message}`,
    )
  })

  return worker
}
