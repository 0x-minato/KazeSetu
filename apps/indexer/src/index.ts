import {
  connectDatabase,
  disconnectDatabase,
} from "./config/db.js"
import {
  DATABASE_URL,
  POLL_INTERVAL_MS,
  STATE_SYNC_INTERVAL_MS,
} from "./config/env.js"
import { closeQueues } from "./queues/dispatcher.js"
import {
  pollAllPoolEvents,
  syncAllPoolStates,
} from "./sync/pool-sync.js"
import { pollAllStakingEvents } from "./sync/staking-sync.js"
import {
  pollAllVaultEvents,
  syncAllVaultStates,
} from "./sync/vault-sync.js"

let isShuttingDown = false
let isPollingEvents = false
let isSyncingState = false
let pollTimer: NodeJS.Timeout | null = null
let stateSyncTimer: NodeJS.Timeout | null = null

const runEventPollCycle = async (): Promise<void> => {
  if (isShuttingDown || isPollingEvents || !DATABASE_URL) return
  isPollingEvents = true
  try {
    await pollAllPoolEvents()
    await pollAllVaultEvents()
    await pollAllStakingEvents()
  } catch (err) {
    console.error(
      "[indexer] Event polling cycle failed:",
      err instanceof Error ? err.message : err,
    )
  } finally {
    isPollingEvents = false
  }
}

const runStateSyncCycle = async (): Promise<void> => {
  if (isShuttingDown || isSyncingState || !DATABASE_URL) return
  isSyncingState = true
  try {
    await Promise.all([syncAllPoolStates(), syncAllVaultStates()])
  } catch (err) {
    console.error(
      "[indexer] Periodic state sync cycle failed:",
      err instanceof Error ? err.message : err,
    )
  } finally {
    isSyncingState = false
  }
}

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`[indexer] Received ${signal}, shutting down gracefully...`)

  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (stateSyncTimer) {
    clearInterval(stateSyncTimer)
    stateSyncTimer = null
  }

  await Promise.allSettled([closeQueues(), disconnectDatabase()])
  console.log("[indexer] Shutdown complete.")
  process.exit(0)
}

const startIndexer = async (): Promise<void> => {
  console.log(
    `[indexer] Booting KazeSetu Blockchain Event Indexer (poll=${POLL_INTERVAL_MS}ms, stateSync=${STATE_SYNC_INTERVAL_MS}ms)...`,
  )

  await connectDatabase()

  process.on("SIGINT", () => {
    void shutdown("SIGINT")
  })
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM")
  })

  await runStateSyncCycle()
  await runEventPollCycle()

  pollTimer = setInterval(() => {
    void runEventPollCycle()
  }, POLL_INTERVAL_MS)

  stateSyncTimer = setInterval(() => {
    void runStateSyncCycle()
  }, STATE_SYNC_INTERVAL_MS)
}

startIndexer().catch((err) => {
  console.error("[indexer] Fatal startup error:", err)
  process.exit(1)
})
