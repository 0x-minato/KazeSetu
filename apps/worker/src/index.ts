import { connectDatabase, disconnectDatabase } from "./config/db.js"
import { redisConnection } from "./config/redis.js"
import {
  createNotificationWorker,
  notificationQueue,
} from "./processors/notification.processor.js"
import {
  createProtocolSyncWorker,
  protocolSyncQueue,
} from "./processors/protocol-sync.processor.js"
import {
  createRewardsWorker,
  rewardsQueue,
} from "./processors/rewards.processor.js"
import { registerScheduledJobs } from "./scheduler.js"

const startWorkerService = async (): Promise<void> => {
  console.log("[worker] Starting KazeSetu background worker service...")

  await connectDatabase()

  const notificationWorker = createNotificationWorker()
  const protocolSyncWorker = createProtocolSyncWorker()
  const rewardsWorker = createRewardsWorker()

  await registerScheduledJobs()

  console.log(
    "[worker] All BullMQ workers (notifications, protocol-sync, rewards) are online",
  )

  let shuttingDown = false
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[worker] Received ${signal}, shutting down gracefully...`)

    try {
      await Promise.allSettled([
        notificationWorker.close(),
        protocolSyncWorker.close(),
        rewardsWorker.close(),
        notificationQueue.close(),
        protocolSyncQueue.close(),
        rewardsQueue.close(),
      ])
      await disconnectDatabase()
      await redisConnection.quit()
      console.log("[worker] Graceful shutdown complete")
      process.exit(0)
    } catch (err) {
      console.error("[worker] Error during shutdown:", err)
      process.exit(1)
    }
  }

  process.on("SIGINT", () => void shutdown("SIGINT"))
  process.on("SIGTERM", () => void shutdown("SIGTERM"))
}

startWorkerService().catch((err) => {
  console.error("[worker] Fatal startup error:", err)
  process.exit(1)
})
