# Background Worker & BullMQ Documentation (`apps/worker/`)

## Overview

`apps/worker` is a dedicated asynchronous job processor powered by **BullMQ** and **Redis**. Following the KazeSetu architecture rules:
- The worker **never exposes HTTP endpoints**.
- It processes event-driven jobs dispatched by `apps/indexer` as well as repeatable scheduled jobs (`SYNC_PRICES`, `SYNC_POOLS`, `SYNC_VAULTS`) registered on startup.
- It communicates with `apps/api` using the constant-time authenticated `x-worker-key` header (`authenticateWorkerOrAdmin`) and falls back to Prisma when needed.

---

## Directory Structure

```text
apps/worker/
├── .env.example
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                              # Boots BullMQ Workers + Scheduler + SIGINT/SIGTERM shutdown
    ├── scheduler.ts                          # Repeatable 60s cron jobs (SYNC_PRICES, SYNC_POOLS, SYNC_VAULTS)
    ├── config/
    │   ├── db.ts                             # Shared Prisma client connection
    │   ├── env.ts                            # Environment configuration & per-chain viem PublicClients
    │   └── redis.ts                          # IORedis connection factory (maxRetriesPerRequest: null for BullMQ)
    ├── lib/
    │   └── api-client.ts                     # HTTP client sending x-worker-key: WORKER_API_KEY to apps/api
    └── processors/
        ├── notification.processor.ts         # Queue: kazesetu-notifications
        ├── protocol-sync.processor.ts        # Queue: kazesetu-protocol-sync
        └── rewards.processor.ts              # Queue: kazesetu-rewards
```

---

## BullMQ Queues & Job Processors

All queue names and payload schemas are shared across `apps/indexer` and `apps/worker` via `@kazesetu/shared` (`packages/shared/src/queues.ts`).

### 1. `kazesetu-notifications` (`notification.processor.ts`)
- **Trigger**: Enqueued by `apps/indexer` whenever an on-chain `Swap`, `Mint`/`Burn`, `Staked`/`Unstaked`/`RewardPaid`, or `KazeClVault` (`Deposit`, `Withdraw`, `HandleFees`, `Rebalance`) event is indexed, or by `apps/worker` when rewards or out-of-range alerts are generated.
- **Payload (`NotificationJobPayload`)**:
  ```ts
  {
    walletAddress: string
    chainId: number
    type: "SWAP" | "LIQUIDITY" | "STAKING" | "VAULT_DEPOSIT" | "VAULT_WITHDRAW" | "VAULT_REBALANCE" | "VAULT_FEES" | "REWARD"
    title: string
    message: string
    txHash?: string | null
  }
  ```
- **Execution**:
  - Calls `POST /api/notifications` with `x-worker-key: WORKER_API_KEY`.
  - If the API process is temporarily restarting, falls back to upserting the `Wallet` and inserting the `Notification` row via Prisma.
  - Configured with `attempts: 3` and exponential backoff (`1000ms` base).

### 2. `kazesetu-protocol-sync` (`protocol-sync.processor.ts`)
Handles three job types (`ProtocolSyncJobPayload.kind`):

1. **`SYNC_PRICES`**:
   - Loads all active allowlisted `Token`s.
   - Queries live USD prices in a single batch from the **DefiLlama Coins API** (`https://coins.llama.fi/prices/current/{chain}:{address}`).
   - Provides deterministic symbol fallbacks (`USDC`, `USDT`, `DAI`, `WETH`, `ETH`, `WBTC`, `KAZE`) for local Anvil forks or testnets where tokens don't have mainnet DefiLlama listings.
   - Pushes each updated quote to `PUT /api/prices/:address?chainId=` with `x-worker-key`.
2. **`SYNC_POOLS`**:
   - Reads on-chain `ERC20.balanceOf(pool.address)` for `token0` and `token1` and `ERC20.totalSupply()` for the pool via `viem`.
   - Formats exact decimal strings using `formatUnitsDecimal` and pushes them to `PUT /api/pools/:address?chainId=`.
3. **`SYNC_VAULTS`**:
   - Reads on-chain `KazeClVault.position()`, `totalSupply()`, `paused()`, `UniswapV3Pool.slot0()`, and `NonfungiblePositionManager.positions(tokenId)`.
   - Computes underlying `amount0` and `amount1` from `sqrtPriceX96`, `tickLower`, `tickUpper`, and `liquidity` using `getAmountsForLiquidity` + `getSqrtRatioAtTick`.
   - Pushes the updated state to `PUT /api/vaults/:address?chainId=`.
   - **Out-of-Range Governor Alert**: If `currentTick < tickLower || currentTick >= tickUpper` while `liquidity > 0` and `ADMIN_ADDRESS` is configured, automatically enqueues a `VAULT_REBALANCE` notification job alerting the governor that the vault is out of range and ready for `rebalance()`.

### 3. `kazesetu-rewards` (`rewards.processor.ts`)
- **Trigger**: Dispatched when a user stakes LP in a `StakingFarm`.
- **Execution**:
  - Queries `STAKING_FARM_ABI.earned(walletAddress)` on-chain (with a staked-position snapshot fallback if the farm contract is not deployed on the current RPC).
  - Enqueues a `REWARD` notification on `kazesetu-notifications` when claimable rewards are accrued.

---

## Scheduled Jobs (`src/scheduler.ts`)

On startup, `registerScheduledJobs()` configures three repeatable BullMQ jobs (`every: 60_000` ms) and triggers an immediate boot sync:
- `repeat:sync-prices` $\rightarrow$ ` { kind: "SYNC_PRICES" }`
- `repeat:sync-pools` $\rightarrow$ `{ kind: "SYNC_POOLS" }`
- `repeat:sync-vaults` $\rightarrow$ `{ kind: "SYNC_VAULTS" }`

---

## Running the Worker

```bash
cd apps/worker
cp .env.example .env
npm install
npm run dev
```
