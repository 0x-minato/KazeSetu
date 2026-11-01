import { Queue } from "bullmq"
import IORedis, { type RedisOptions } from "ioredis"
import {
  QUEUE_NAMES,
  type NotificationJobPayload,
  type ProtocolSyncJobPayload,
  type RewardCalcJobPayload,
} from "../../../../packages/shared/src/index.ts"
import { REDIS_DISABLED, REDIS_URL } from "../config/env.js"

let redisConnection: IORedis | null = null
let notificationsQueue: Queue<NotificationJobPayload> | null = null
let protocolSyncQueue: Queue<ProtocolSyncJobPayload> | null = null
let rewardsQueue: Queue<RewardCalcJobPayload> | null = null
let redisHealthy = false
let warnedUnavailable = false

const initQueues = (): void => {
  if (REDIS_DISABLED) {
    if (!warnedUnavailable) {
      console.warn(
        "[indexer:queues] REDIS_URL is disabled; BullMQ job dispatching will be skipped",
      )
      warnedUnavailable = true
    }
    return
  }

  if (redisConnection) return

  try {
    const options: RedisOptions = {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      connectTimeout: 3_000,
      retryStrategy(times: number) {
        return Math.min(times * 1_000, 10_000)
      },
    }

    redisConnection = new IORedis(REDIS_URL, options)

    redisConnection.on("ready", () => {
      redisHealthy = true
      warnedUnavailable = false
      console.log("[indexer:queues] Redis connected for BullMQ job dispatcher")
    })

    redisConnection.on("error", (err) => {
      redisHealthy = false
      if (!warnedUnavailable) {
        console.warn(
          `[indexer:queues] Redis unavailable (${err.message}); continuing PostgreSQL indexing without job dispatch`,
        )
        warnedUnavailable = true
      }
    })

    redisConnection.on("end", () => {
      redisHealthy = false
    })

    notificationsQueue = new Queue<NotificationJobPayload>(
      QUEUE_NAMES.NOTIFICATIONS,
      { connection: redisConnection },
    )
    protocolSyncQueue = new Queue<ProtocolSyncJobPayload>(
      QUEUE_NAMES.PROTOCOL_SYNC,
      { connection: redisConnection },
    )
    rewardsQueue = new Queue<RewardCalcJobPayload>(
      QUEUE_NAMES.REWARDS,
      { connection: redisConnection },
    )
  } catch (err) {
    redisHealthy = false
    if (!warnedUnavailable) {
      console.warn(
        "[indexer:queues] Failed to initialize BullMQ queues; continuing without Redis:",
        err instanceof Error ? err.message : err,
      )
      warnedUnavailable = true
    }
  }
}

initQueues()

export const enqueueNotification = async (
  payload: NotificationJobPayload,
): Promise<void> => {
  if (REDIS_DISABLED || !notificationsQueue || !redisHealthy) {
    return
  }
  try {
    const normalizedPayload: NotificationJobPayload = {
      ...payload,
      walletAddress: payload.walletAddress.trim().toLowerCase(),
      txHash: payload.txHash ? payload.txHash.trim().toLowerCase() : null,
    }
    await notificationsQueue.add(payload.type, normalizedPayload, {
      removeOnComplete: 500,
      removeOnFail: 1_000,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1_000,
      },
    })
  } catch (err) {
    console.warn(
      "[indexer:queues] Failed to enqueue notification job:",
      err instanceof Error ? err.message : err,
    )
  }
}

export const enqueueProtocolSync = async (
  payload: ProtocolSyncJobPayload,
): Promise<void> => {
  if (REDIS_DISABLED || !protocolSyncQueue || !redisHealthy) {
    return
  }
  try {
    await protocolSyncQueue.add(payload.kind, payload, {
      removeOnComplete: 200,
      removeOnFail: 500,
      attempts: 2,
    })
  } catch (err) {
    console.warn(
      "[indexer:queues] Failed to enqueue protocol sync job:",
      err instanceof Error ? err.message : err,
    )
  }
}

export const enqueueRewardCalculation = async (
  payload: RewardCalcJobPayload,
): Promise<void> => {
  if (REDIS_DISABLED || !rewardsQueue || !redisHealthy) {
    return
  }
  try {
    const normalizedPayload: RewardCalcJobPayload = {
      ...payload,
      farmAddress: payload.farmAddress?.trim().toLowerCase(),
      walletAddress: payload.walletAddress?.trim().toLowerCase(),
      txHash: payload.txHash ? payload.txHash.trim().toLowerCase() : null,
    }
    await rewardsQueue.add("CALC_REWARDS", normalizedPayload, {
      removeOnComplete: 200,
      removeOnFail: 500,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1_000,
      },
    })
  } catch (err) {
    console.warn(
      "[indexer:queues] Failed to enqueue reward calculation job:",
      err instanceof Error ? err.message : err,
    )
  }
}

export const closeQueues = async (): Promise<void> => {
  await Promise.allSettled([
    notificationsQueue?.close(),
    protocolSyncQueue?.close(),
    rewardsQueue?.close(),
  ])
  if (redisConnection) {
    await redisConnection.quit().catch(() => {
      redisConnection?.disconnect()
    })
    redisConnection = null
  }
}
