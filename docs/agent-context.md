# KazeSetu — Agent & Engineering Context

Read this before changing `apps/api`, `apps/indexer`, `apps/worker`, `apps/web`, `packages/shared`, `prisma`, or protocol accounting. Pair with `.cursor/rules/architecture.mdc`.

KazeSetu is a production-grade DeFi platform combining **Uniswap V3 Concentrated Liquidity Vaults (`KazeClVault`)**, **AMM Liquidity Pools**, **Yield Farms**, **Event Indexing**, **BullMQ Background Workers**, and an **Institutional Portfolio Terminal**.

- The **API (`apps/api`) is a modular Express 5 monolith**.
- The **Chain (`contracts/`) is the source of truth** for protocol state.
- **PostgreSQL** is an **application projection** (analytics, SIWE sessions, cached oracle prices, indexed events, and notifications) — not a second ledger.
- **BullMQ + Redis (`apps/worker`)** handles asynchronous jobs (notifications, 60s oracle price sync, pool reserve sync, vault state sync, and reward calculations).

---

## Repo Layout

```text
KazeSetu/
├── apps/
│   ├── api/            # Express 5 + Prisma 7 modular monolith API (port 3001)
│   ├── indexer/        # Viem blockchain event indexer + BullMQ producer
│   ├── worker/         # BullMQ background job processor + 60s cron scheduler
│   └── web/            # Next.js 15 + React 19 + Viem frontend terminal (port 5173)
├── packages/
│   └── shared/         # @kazesetu/shared: ABIs, CL tick/liquidity math, BullMQ queue contracts
├── contracts/          # Foundry / Solidity 0.8.27 (KazeClVault UUPS, TickMath, LiquidityAmounts)
├── docker/             # Dockerfiles for api, indexer, worker, and web
├── docs/               # Service-by-service documentation
├── docker-compose.yml  # Postgres 16 + Redis 7 + optional full-stack containers
└── package.json        # Root workspace scripts
```

---

## Architecture (Non-Negotiable)

1. **Modular Monolith API (`apps/api`)**:
   ```text
   Client → Router → Controller → Service → Repository → Prisma / PostgreSQL
   ```
   - Controllers parse/validate inputs, call services, and return `sendSuccess`. Never call Prisma from controllers.
   - Services own all business logic and `Prisma.Decimal` math.
   - Repositories are the only layer touching Prisma.
2. **Non-HTTP Indexer & Worker**:
   - `apps/indexer` only listens to chain events, updates PostgreSQL projections, and dispatches BullMQ jobs.
   - `apps/worker` only consumes BullMQ queues and executes scheduled jobs (`SYNC_PRICES`, `SYNC_POOLS`, `SYNC_VAULTS`). Neither exposes HTTP endpoints.
3. **Shared Code (`packages/shared`)**:
   - Contract ABIs (`KAZE_CL_VAULT_ABI`, `UNISWAP_V3_POOL_ABI`, `NONFUNGIBLE_POSITION_MANAGER_ABI`, `UNISWAP_V3_SWAP_ROUTER_ABI`, `ERC20_ABI`, `STAKING_FARM_ABI`), Concentrated Liquidity math (`getSqrtRatioAtTick`, `getAmountsForLiquidity`), and BullMQ queue contracts (`QUEUE_NAMES`) live in `packages/shared`.

---

## Identity and Auth

**Wallet is the account.** There is no `User` model.

| Concept | Implementation |
|---|---|
| Identity | `Wallet.address` unique, stored lowercase |
| Role | `Wallet.role`: `USER` \| `ADMIN` |
| Admin | SIWE address matching `ADMIN_ADDRESS` → `ADMIN`; otherwise `USER` |
| Access token | JWT HS256, `sub` = address, claim `role`. TTL 15 minutes |
| `req.auth` | `{ address, role }` after `authenticateAccessToken` |
| Refresh | `httpOnly` cookie `refreshToken`, path `/api/auth`. Reuse of a rotated token revokes the entire `RefreshSession` |
| SIWE nonce | Single-use, 5m TTL, persisted in `AuthNonce` (`auth_nonce` table) |
| Worker Auth | `authenticateWorkerOrAdmin` checks `x-worker-key` against `WORKER_API_KEY` (timing-safe SHA-256 compare) or falls back to Admin Bearer JWT |

---

## HTTP Envelope

Success (`sendSuccess`):
```json
{ "success": true, "data": <payload>, "message": "<optional>" }
```

Error (`errorHandler`):
```json
{ "success": false, "message": "<string>", "details": <optional> }
```

---

## API Modules (`apps/api/src/`)

| Module | Base | Notes |
|---|---|---|
| `auth` | `/api/auth` | `POST /nonce`, `POST /verify`, `POST /refresh`, `POST /logout` |
| `tokens` | `/api/tokens` | `GET /`, `GET /:address?chainId=`, `POST /` (Admin: create or reactivate inactive token) |
| `prices` | `/api/prices` | `GET /`, `GET /:address?chainId=`, `PUT /:address?chainId=` (Worker or Admin) |
| `pools` | `/api/pools` | Canonical `token0 < token1`. `GET /`, `GET /:address`, `POST /` (Admin), `PUT /:address` (Worker or Admin) |
| `vaults` | `/api/vaults` | `KazeClVault` projection. `GET /`, `GET /me`, `GET /events/me`, `GET /events/:txHash`, `GET /:address`, `POST /` (Admin), `PUT /:address` (Worker or Admin) |
| `portfolio` | `/api/portfolio/me` | Consolidated Unstaked LP + Staked LP (merged per pool) + `KazeClVault` share positions |
| `liquidity` | `/api/liquidity` | `GET /me`, `GET /events/me`, `GET /events/:txHash?chainId=` |
| `swaps` | `/api/swaps` | `GET /me`, `GET /:txHash?chainId=` |
| `staking` | `/api/staking` | `GET /`, `GET /:address`, `GET /me`, `GET /events/me`, `GET /events/:txHash`, `POST /` (Admin) |
| `analytics` | `/api/analytics` | `GET /overview`, `/tvl` (Pools + CL Vaults), `/volume` (24h), `/liquidity` (24h net inflow/outflow) |
| `notifications` | `/api/notifications` | `GET /me`, `PATCH /:id/read`, `POST /read-all`, `POST /` (Worker or Admin) |

---

## Protocol Accounting Invariants

1. **AMM Pool LP + Staked LP Valuation**:
   $$\text{amount0} = \frac{\text{lp} + \text{stakedLp}}{\text{totalSupply}} \times \text{reserve0}, \quad \text{amount1} = \frac{\text{lp} + \text{stakedLp}}{\text{totalSupply}} \times \text{reserve1}$$
   - When `apps/indexer` indexes a `Staked` event, it decrements `LiquidityPosition.lpTokenAmount` and increments `StakingPosition.stakedAmount` (and reverses on `Unstaked`) so merging by pool in `portfolio.service.ts` never double-counts LP.
2. **Concentrated Liquidity Vault (`KazeClVault`) Valuation**:
   - On-chain `amount0` and `amount1` are derived from `sqrtPriceX96`, `tickLower`, `tickUpper`, and `liquidity` via `LiquidityAmounts.getAmountsForLiquidity`.
   - User vault claims:
     $$\text{userAmount0} = \frac{\text{shares}}{\text{totalSupply}} \times \text{vault.amount0}, \quad \text{userAmount1} = \frac{\text{shares}}{\text{totalSupply}} \times \text{vault.amount1}$$
   - `inRange = currentTick >= tickLower && currentTick < tickUpper`.
3. **Fail-Loud on Broken Supply Invariant**:
   - If `pool.totalSupply === 0` (or `vault.totalSupply === 0`) while a user holds non-zero LP or shares, the API throws `500 Internal Server Error` with `{ address, chainId }` details instead of silently returning `$0`.
4. **Missing Oracle Price**:
   - `getPriceUsdOrZero` returns `Decimal(0)` so rows with unpriced tokens still render their token amounts in the user's portfolio.
