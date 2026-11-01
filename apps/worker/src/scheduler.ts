import { SYNC_INTERVAL_MS } from "./config/env.js"
import { protocolSyncQueue } from "./processors/protocol-sync.processor.js"

export const registerScheduledJobs = async (): Promise<void> => {
  const schedules: Array<{
    name: string
    kind: "SYNC_PRICES" | "SYNC_POOLS" | "SYNC_VAULTS"
    jobId: string
  }> = [
    {
      name: "scheduled-sync-prices",
      kind: "SYNC_PRICES",
      jobId: "repeat:sync-prices",
    },
    {
      name: "scheduled-sync-pools",
      kind: "SYNC_POOLS",
      jobId: "repeat:sync-pools",
    },
    {
      name: "scheduled-sync-vaults",
      kind: "SYNC_VAULTS",
      jobId: "repeat:sync-vaults",
    },
  ]

  for (const item of schedules) {
    await protocolSyncQueue.add(
      item.name,
      { kind: item.kind },
      {
        jobId: item.jobId,
        repeat: {
          every: SYNC_INTERVAL_MS,
        },
      },
    )

    // Trigger an immediate initial sync on worker boot
    await protocolSyncQueue.add(`${item.name}-initial`, {
      kind: item.kind,
    })
  }

  console.log(
    `[worker:scheduler] Registered repeatable jobs (SYNC_PRICES, SYNC_POOLS, SYNC_VAULTS) every ${SYNC_INTERVAL_MS}ms`,
  )
}
