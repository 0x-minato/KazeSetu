# Backend API Documentation (`apps/api/`)

## Overview

`apps/api` is the primary business layer of **KazeSetu**, implemented as a **Modular Monolith** using **Express 5**, **TypeScript (ESM)**, **Prisma 7**, **PostgreSQL**, **Zod 4**, and **SIWE (EIP-4361)**.

### Core Architectural Principles
1. **Strict Layered Dependency Flow**:
   $$\text{Client} \longrightarrow \text{Router} \longrightarrow \text{Controller} \longrightarrow \text{Service} \longrightarrow \text{Repository} \longrightarrow \text{Prisma / PostgreSQL}$$
   - **Controllers** parse/validate request parameters and return standardized HTTP envelopes. They never call Prisma directly.
   - **Services** enforce domain invariants, Decimal math, and cross-module orchestration.
   - **Repositories** encapsulate all Prisma queries.
2. **Source-of-Truth Separation**:
   - The **Blockchain** owns balances, reserves, LP ownership, and vault shares.
   - **PostgreSQL** stores the application projection (allowlisted tokens/pools/farms/vaults, SIWE nonces, rotating refresh sessions, cached oracle prices, indexed events, and user notifications).
3. **Wallet-as-Account Identity**:
   - There is no `User` table. `Wallet.address` (stored lowercase) is the canonical identity.
   - One genesis administrator is configured via `ADMIN_ADDRESS`.
4. **Precision Financial Math**:
   - All token amounts, reserves, LP supplies, vault shares, and USD prices use `@db.Decimal(36, 18)` in PostgreSQL and `Prisma.Decimal` in TypeScript—never floating-point `Number()`.

---

## Standardized HTTP Envelope

Every endpoint (except `GET /health`) is mounted under `/api` and returns a uniform JSON envelope:

- **Success (`200` / `201`)**:
  ```json
  {
    "success": true,
    "data": { ... },
    "message": "Optional message"
  }
  ```
- **Error (`400` / `401` / `403` / `404` / `409` / `429` / `500`)**:
  ```json
  {
    "success": false,
    "message": "Human-readable error description",
    "details": { ... }
  }
  ```

---

## Authentication & Authorization

### 1. SIWE (Sign-In with Ethereum — EIP-4361)
- **`POST /api/auth/nonce`**: Generates a 16-byte hex nonce with a 5-minute TTL stored in the `auth_nonce` table (`AuthNonce`) so multi-process API deployments can validate nonces deterministically.
- **`POST /api/auth/verify`**:
  - Validates the EIP-4361 message (`domain === SIWE_DOMAIN`, `uri === SIWE_URI`, `chainId` in `SIWE_ALLOWED_CHAIN_IDS`, clock skew & expiration) and verifies the ECDSA signature.
  - Atomically consumes the nonce (`DELETE ... WHERE nonce = $1`).
  - Upserts the `Wallet` row (promoting to `Role.ADMIN` if `address === ADMIN_ADDRESS`).
  - Returns a 15-minute `HS256` Bearer `accessToken` (`sub = address`, `role = USER | ADMIN`) and sets an `httpOnly` `refreshToken` cookie scoped to `/api/auth`.
- **`POST /api/auth/refresh`**:
  - Reads the `refreshToken` cookie, verifies the session is active, and rotates the token.
  - **Reuse Detection**: If a previously rotated/revoked refresh token is presented again, the entire `RefreshSession` is immediately revoked.
- **`POST /api/auth/logout`**:
  - Revokes the active `RefreshSession` and clears the `refreshToken` cookie.

### 2. Worker-or-Admin Middleware (`authenticateWorkerOrAdmin`)
State-synchronization endpoints (`PUT /api/prices/:address`, `PUT /api/pools/:address`, `PUT /api/vaults/:address`, `POST /api/notifications`) accept **either**:
- Header `x-worker-key: <WORKER_API_KEY>` (compared in constant time via SHA-256 + `crypto.timingSafeEqual`), **or**
- Standard `Authorization: Bearer <accessToken>` where `role === "ADMIN"`.

---

## Domain Modules & Endpoint Reference

### 1. Health
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Returns `{ "status": "ok" }` |

### 2. Auth (`/api/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/nonce` | Public | Issue single-use 5m SIWE nonce |
| `POST` | `/api/auth/verify` | Public | Verify `{ message, signature }`, set refresh cookie, return `{ address, chainId, accessToken }` |
| `POST` | `/api/auth/refresh` | Cookie | Rotate `refreshToken` cookie and return new `accessToken` string |
| `POST` | `/api/auth/logout` | Cookie | Revoke refresh session and clear cookie |

### 3. Tokens (`/api/tokens`)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/tokens` | Bearer JWT | List all active allowlisted tokens |
| `GET` | `/api/tokens/:address?chainId=` | Bearer JWT | Get active token by address & chainId |
| `POST` | `/api/tokens` | Admin JWT | Allowlist a new token or reactivate an inactive token (`409` if already active) |

### 4. Prices (`/api/prices`)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/prices` | Bearer JWT | List latest cached USD prices for active tokens |
| `GET` | `/api/prices/:address?chainId=` | Bearer JWT | Get cached USD price for a token |
| `PUT` | `/api/prices/:address?chainId=` | Worker Key or Admin | Upsert `{ priceUsd }` for a token |

### 5. Pools (`/api/pools`)
Enforces canonical token ordering (`token0.address < token1.address` in lowercase hex), automatically swapping `reserve0` and `reserve1` on creation if submitted in reverse order.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/pools` | Bearer JWT | List active pools with `token0` and `token1` |
| `GET` | `/api/pools/:address?chainId=` | Bearer JWT | Get single pool by address & chainId |
| `POST` | `/api/pools` | Admin JWT | Register a canonical AMM pool |
| `PUT` | `/api/pools/:address?chainId=` | Worker Key or Admin | Sync on-chain `{ reserve0, reserve1, totalSupply, isActive? }` |

### 6. Concentrated Liquidity Vaults (`/api/vaults`)
Connects `KazeClVault` (`contracts/src/vault/clVault.sol`) to the API layer.
- Computes `inRange = currentTick >= tickLower && currentTick < tickUpper`.
- Computes `tvlUsd = amount0 * price0Usd + amount1 * price1Usd`.
- Computes user vault share claims:
  $$\text{userAmount0} = \frac{\text{shares}}{\text{totalSupply}} \times \text{vault.amount0}, \quad \text{userAmount1} = \frac{\text{shares}}{\text{totalSupply}} \times \text{vault.amount1}$$

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/vaults` | Bearer JWT | List all active `ClVault` instances with live `tvlUsd` and `inRange` |
| `GET` | `/api/vaults/me` | Bearer JWT | List caller's `VaultPosition` holdings (`shares > 0`) with underlying token claims & USD value |
| `GET` | `/api/vaults/events/me` | Bearer JWT | List caller's `DEPOSIT`, `WITHDRAW`, `REBALANCE`, and `HANDLE_FEES` events |
| `GET` | `/api/vaults/events/:txHash?chainId=` | Bearer JWT | Inspect a specific vault event by transaction hash |
| `GET` | `/api/vaults/:address?chainId=` | Bearer JWT | Get single `ClVault` by address & chainId |
| `POST` | `/api/vaults` | Admin JWT | Register a deployed `KazeClVault` contract (`tickLower < tickUpper`) |
| `PUT` | `/api/vaults/:address?chainId=` | Worker Key or Admin | Sync on-chain vault state (`tickLower`, `tickUpper`, `currentTick`, `sqrtPriceX96`, `tokenId`, `liquidity`, `amount0`, `amount1`, `totalSupply`, `isPaused`) |

### 7. Portfolio (`/api/portfolio`)
 Consolidates:
1. Unstaked AMM LP (`LiquidityPosition`) + Staked Farm LP (`StakingPosition`) merged per `(chainId, pool.address)`:
   $$\text{amount0} = \frac{\text{lp} + \text{stakedLp}}{\text{totalSupply}} \times \text{reserve0}, \quad \text{amount1} = \frac{\text{lp} + \text{stakedLp}}{\text{totalSupply}} \times \text{reserve1}$$
2. Concentrated Liquidity Vault positions (`VaultPosition`).
- Missing oracle prices default to `Decimal(0)` so user positions are never hidden.
- Corrupted on-chain state (`totalSupply === 0` while user holds non-zero LP or shares) throws `500 Internal Server Error` with `{ address, chainId }` details rather than silently reporting `$0`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/portfolio/me` | Bearer JWT | Returns `{ positions, vaultPositions, totalValueUsd }` |

### 8. Liquidity (`/api/liquidity`), Swaps (`/api/swaps`), & Staking (`/api/staking`)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/liquidity/me` | Bearer JWT | Caller's unstaked LP positions (`lpTokenAmount > 0`) |
| `GET` | `/api/liquidity/events/me` | Bearer JWT | Caller's `ADD` / `REMOVE` LP events |
| `GET` | `/api/liquidity/events/:txHash?chainId=` | Bearer JWT | Lookup LP event by txHash |
| `GET` | `/api/swaps/me` | Bearer JWT | Caller's indexed swaps |
| `GET` | `/api/swaps/:txHash?chainId=` | Bearer JWT | Lookup swap by txHash |
| `GET` | `/api/staking` | Bearer JWT | List active yield farms |
| `GET` | `/api/staking/:address?chainId=` | Bearer JWT | Get single yield farm |
| `GET` | `/api/staking/me` | Bearer JWT | Caller's staked LP positions |
| `GET` | `/api/staking/events/me` | Bearer JWT | Caller's `STAKE` / `UNSTAKE` / `CLAIM` events |
| `GET` | `/api/staking/events/:txHash?chainId=` | Bearer JWT | Lookup staking event by txHash |
| `POST` | `/api/staking` | Admin JWT | Register a new `StakingFarm` |

### 9. Analytics (`/api/analytics`)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/analytics/overview` | Bearer JWT | Combined `{ tvl, volume, liquidity }` |
| `GET` | `/api/analytics/tvl` | Bearer JWT | Total USD locked across active `Pool`s and `ClVault`s |
| `GET` | `/api/analytics/volume` | Bearer JWT | Rolling 24h settled `Swap` volume in USD |
| `GET` | `/api/analytics/liquidity` | Bearer JWT | Rolling 24h net liquidity flow: $\Sigma(\text{ADD} + \text{DEPOSIT}) - \Sigma(\text{REMOVE} + \text{WITHDRAW})$ |

### 10. Notifications (`/api/notifications`)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/notifications/me` | Bearer JWT | Latest 50 notifications for the caller |
| `PATCH` | `/api/notifications/:id/read` | Bearer JWT | Mark a single notification as read |
| `POST` | `/api/notifications/read-all` | Bearer JWT | Mark all unread notifications for the caller as read |
| `POST` | `/api/notifications` | Worker Key or Admin | Create a notification for a wallet address |

---

## Local Development Commands

```bash
cd apps/api
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```
