# Blockchain Event Indexer Documentation (`apps/indexer/`)

## Overview

`apps/indexer` is a standalone, non-HTTP Node.js/TypeScript process that synchronizes on-chain state from EVM networks into PostgreSQL and dispatches asynchronous jobs to **BullMQ** queues.

In accordance with the KazeSetu architecture rules:
- The indexer **never exposes HTTP endpoints** and contains **no user-facing business logic**.
- Its sole responsibilities are:
  1. Polling contract event logs (`viem` `getLogs` + `parseEventLogs`) with persistent block cursors (`IndexerCursor`).
  2. Updating PostgreSQL projections (`ClVault`, `VaultPosition`, `VaultEvent`, `Pool`, `Swap`, `LiquidityPosition`, `LiquidityEvent`, `StakingPosition`, `StakingEvent`).
  3. Dispatching background jobs (`kazesetu-notifications`, `kazesetu-protocol-sync`, `kazesetu-rewards`) to BullMQ.

---

## Directory Structure

```text
apps/indexer/
├── .env.example
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                 # Main orchestrator (event polling loop + state sync loop + graceful shutdown)
    ├── config/
    │   ├── db.ts                # Shared Prisma client, wallet upsert, and IndexerCursor persistence
    │   └── env.ts               # Per-chain viem PublicClient factory and polling configuration
    ├── queues/
    │   └── dispatcher.ts        # Resilient BullMQ producer (gracefully degrades if Redis is offline)
    └── sync/
        ├── vault-sync.ts        # KazeClVault event indexing + slot0 / NonfungiblePositionManager state sync
        ├── pool-sync.ts         # UniswapV3Pool Swap / Mint / Burn indexing + ERC20 reserve sync
        └── staking-sync.ts      # StakingFarm Staked / Unstaked / RewardPaid indexing + LP transfer invariant
```

---

## Synchronization Pipelines

### 1. Concentrated Liquidity Vault Pipeline (`src/sync/vault-sync.ts`)
Watches all active `ClVault` contracts registered in PostgreSQL using `KAZE_CL_VAULT_ABI` from `@kazesetu/shared`:

- **`Deposit(sender, amount0Used, amount1Used, shares, receiver)`**:
  - Upserts the `Wallet` for `receiver` (lowercase).
  - Upserts `VaultEvent` (`type: "DEPOSIT"`, `status: "SUCCESS"`).
  - Increments `VaultPosition.shares` for `(walletId, vaultId)` (or syncs exact `balanceOf(receiver)` from chain).
  - Refreshes the vault's on-chain state and dispatches a `VAULT_DEPOSIT` notification job.
- **`Withdraw(sender, amount0Withdraw, amount1Withdraw, liquidity, receiver)`**:
  - Upserts `VaultEvent` (`type: "WITHDRAW"`, `status: "SUCCESS"`).
  - Syncs `VaultPosition.shares` from `vault.balanceOf(sender)` on-chain (with safe decrement fallback).
  - Refreshes the vault's on-chain state and dispatches a `VAULT_WITHDRAW` notification job.
- **`HandleFees(liquidityAdded, amount0Used, amount1Used)`**:
  - Records `VaultEvent` (`type: "HANDLE_FEES"`), refreshes vault liquidity/amounts, and dispatches a `VAULT_FEES` notification.
- **`Rebalance(old_lower_tick, old_upper_tick, new_lower_tick, new_upper_tick, new_liquidity, amount0_used, amount1_used)`**:
  - Records `VaultEvent` (`type: "REBALANCE"` with old and new tick boundaries), refreshes the vault's new `tickLower`, `tickUpper`, `tokenId`, and `liquidity`, and dispatches a `VAULT_REBALANCE` notification.

#### On-Chain Vault State Refresh (`refreshVaultOnChainState`)
Reads in parallel via `viem`:
1. `vault.position()` $\rightarrow$ `(pool, tickLower, tickUpper, tokenId)`
2. `vault.totalSupply()` and `vault.paused()`
3. `pool.slot0()` $\rightarrow$ `(sqrtPriceX96, currentTick)`
4. `manager.positions(tokenId)` $\rightarrow$ `liquidity` (when `tokenId > 0`)
5. Computes exact underlying `amount0` and `amount1` using `getAmountsForLiquidity(sqrtPriceX96, getSqrtRatioAtTick(tickLower), getSqrtRatioAtTick(tickUpper), liquidity)` from `@kazesetu/shared` and updates `prisma.clVault`.

---

### 2. Pool & Liquidity Pipeline (`src/sync/pool-sync.ts`)
Watches all active `Pool` contracts using `UNISWAP_V3_POOL_ABI`:
- **`Swap`**: Determines `tokenIn`, `tokenOut`, `amountIn`, and `amountOut` from the signs of `amount0` and `amount1`, upserts `Swap` (`status: "SUCCESS"`), and dispatches `SWAP` notification + `SYNC_POOLS` jobs.
- **`Mint` (`ADD`) & `Burn` (`REMOVE`)**: Upserts `LiquidityEvent`, adjusts `LiquidityPosition.lpTokenAmount`, and dispatches a `LIQUIDITY` notification job.

---

### 3. Staking Farm Pipeline & LP Accounting Invariant (`src/sync/staking-sync.ts`)
Watches all active `StakingFarm` contracts using `STAKING_FARM_ABI`:
- **`Staked(user, amount)`**:
  - Upserts `StakingEvent` (`STAKE`).
  - **Crucial Accounting Invariant**: Atomically **decrements** `LiquidityPosition.lpTokenAmount` on `farm.poolId` and **increments** `StakingPosition.stakedAmount` on `farm.id` inside a Prisma transaction. Because `portfolio.service.ts` sums `LiquidityPosition + StakingPosition` on the same pool, moving LP between the two tables guarantees staked LP is valued accurately without ever being double-counted.
  - Dispatches `STAKING` notification and `REWARDS` calculation jobs.
- **`Unstaked(user, amount)`**:
  - Atomically **decrements** `StakingPosition.stakedAmount` and **increments** `LiquidityPosition.lpTokenAmount`.
- **`RewardPaid(user, reward)`**:
  - Upserts `StakingEvent` (`CLAIM`) and dispatches a `REWARD` notification job.

---

## Block Cursor Persistence (`IndexerCursor`)

For every `(chainId, contractAddress)` pair, the indexer stores `lastBlock` in the `indexer_cursors` PostgreSQL table:
- On first boot for a contract, it starts at `currentBlock - START_BLOCK_OFFSET` (default `100` blocks).
- On subsequent polls, it queries `[lastBlock + 1, min(currentBlock, lastBlock + MAX_BLOCK_RANGE)]` (default `2000` blocks per batch) so it never exceeds RPC log range limits and can resume cleanly after restarts.

---

## Running the Indexer

```bash
cd apps/indexer
cp .env.example .env
npm install
npm run dev
```
