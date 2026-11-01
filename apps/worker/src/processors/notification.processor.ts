import { Queue, Worker, type Job } from "bullmq"
import {
  QUEUE_NAMES,
  type NotificationJobPayload,
} from "../../../../packages/shared/src/index.ts"
import { createRedisConnection } from "../config/redis.js"
import { prisma } from "../config/db.js"
import { workerApiClient } from "../lib/api-client.js"
import type { NotificationType } from "../../../api/app/generated/prisma/client.js"

export const notificationQueue = new Queue<NotificationJobPayload>(
  QUEUE_NAMES.NOTIFICATIONS,
  {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2_000,
      },
      removeOnComplete: 250,
      removeOnFail: 500,
    },
  },
)

export const enqueueNotification = async (
  payload: NotificationJobPayload,
): Promise<void> => {
  const deduplicationId = payload.txHash
    ? `notif:${payload.chainId}:${payload.type}:${payload.walletAddress.toLowerCase()}:${payload.txHash.toLowerCase()}`
    : undefined

  await notificationQueue.add(
    payload.type,
    {
      ...payload,
      walletAddress: payload.walletAddress.toLowerCase(),
      txHash: payload.txHash ? payload.txHash.toLowerCase() : null,
    },
    deduplicationId ? { jobId: deduplicationId } : undefined,
  )
}

const persistNotificationDirect = async (
  payload: NotificationJobPayload,
): Promise<void> => {
  const normalizedAddress = payload.walletAddress.trim().toLowerCase()
  const normalizedTxHash = payload.txHash
    ? payload.txHash.trim().toLowerCase()
    : null

  const wallet = await prisma.wallet.upsert({
    where: { address: normalizedAddress },
    update: {},
    create: { address: normalizedAddress },
  })

  if (normalizedTxHash) {
    const existing = await prisma.notification.findFirst({
      where: {
        walletId: wallet.id,
        chainId: payload.chainId,
        type: payload.type as NotificationType,
        txHash: normalizedTxHash,
      },
    })
    if (existing) {
      return
    }
  }

  await prisma.notification.create({
    data: {
      walletId: wallet.id,
      chainId: payload.chainId,
      type: payload.type as NotificationType,
      title: payload.title,
      message: payload.message,
      txHash: normalizedTxHash,
    },
  })
}

export const processNotificationJob = async (
  job: Job<NotificationJobPayload>,
): Promise<void> => {
  const payload = job.data
  if (!payload?.walletAddress || !payload.type) {
    throw new Error("Invalid NotificationJobPayload: missing walletAddress or type")
  }

  try {
    await workerApiClient.createNotification(payload)
  } catch (apiError) {
    console.warn(
      `[worker:notifications] API POST /api/notifications failed (${(apiError as Error).message}), falling back to Prisma upsert`,
    )
    await persistNotificationDirect(payload)
  }
}

export const createNotificationWorker = (): Worker<NotificationJobPayload> => {
  const worker = new Worker<NotificationJobPayload>(
    QUEUE_NAMES.NOTIFICATIONS,
    processNotificationJob,
    {
      connection: createRedisConnection(),
      concurrency: 5,
    },
  )

  worker.on("completed", (job) => {
    console.log(
      `[worker:notifications] Completed job ${job.id} (${job.data.type} -> ${job.data.walletAddress})`,
    )
  })

  worker.on("failed", (job, err) => {
    console.error(
      `[worker:notifications] Failed job ${job?.id}: ${err.message}`,
    )
  })

  return worker
}
