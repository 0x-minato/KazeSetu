# KazeSetu — agent context

Read this before changing `apps/api`, `prisma`, or protocol accounting. Pair with `.cursor/rules/architecture.mdc`.

KazeSetu is a production-oriented DeFi platform (portfolio, AMM LP, staking, analytics). The **API is a modular Express monolith**. Chain is the source of truth for protocol state. Postgres is an **application projection** (analytics, sessions, cached prices, indexed events) — not a second ledger.

This document reflects the codebase as of the identity/portfolio/auth hardening and post-test bugfix pass. Worker and indexer apps **do not exist yet**; do not invent them.

---

## Working with the human

- Prefer matching existing architecture over introducing a new pattern.
- Do **not** stand up worker, indexer, Redis, extra Express apps, or microservices unless explicitly asked.
- After a module is signed off as good enough, stop nitpicking it.
- Addresses: hex is case-insensitive. Lowercasing does **not** change the 20 bytes. Compare and store **lowercase**. EIP-55 checksum and lowercase are the same wallet.
- One genesis admin: `ADMIN_ADDRESS` (env, trimmed, lowercased). No User table, no multi-admin bootstrap ceremony.
- Commit / PR only when asked.

---

## Repo layout (what actually exists)

```
apps/api/     Express + Prisma API (this is the live backend)
apps/web/     Next.js frontend
contracts/    Foundry / Solidity
packages/     shared packages (use when logic is shared; do not duplicate)
docs/         documentation
```

README also lists `apps/worker` and `apps/indexer`. Those are **planned**, not present. Redis/BullMQ in the README are target infra, not current API code.

`apps/api` is TypeScript ESM (`"type": "module"`), Express 5, Prisma 7, Postgres. Scripts live in `apps/api/package.json` (`npm run dev`, `prisma:*`). Prisma client is generated to `apps/api/app/generated/prisma` — **not** the default `@prisma/client` import path for models/enums.

---

## Architecture (non-negotiable)

Modular monolith. One Express app.

```
Client → Controller → Service → Repository → Prisma/Postgres
```

- Controllers: parse/auth’d input, call service, `sendSuccess`. No Prisma.
- Services: business logic. Talk to other modules via **services**, not repositories.
- Repositories: the only Prisma access.
- DTOs: Zod. Addresses and tx hashes lowercased on parse.
- Errors: throw `ApiError` helpers (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `internalServerError`). `errorHandler` serializes them.

Do not bypass layers. Do not add a second HTTP server for jobs.

---

## Identity and auth

**Wallet is the account.** There is no `User` model.

| Concept | Implementation |
|---|---|
| Identity | `Wallet.address` unique, stored lowercase |
| Role | `Wallet.role`: `USER` \| `ADMIN` |
| Admin | SIWE address matching `ADMIN_ADDRESS` → `ADMIN`; otherwise `USER`. Existing row is promoted/demoted if env changes |
| Access token | JWT HS256, `sub` = address, claim `role`. TTL 15 minutes |
| `req.auth` | `{ address, role }` after `authenticateAccessToken` |
| Refresh | httpOnly cookie `refreshToken`, path `/api/auth`. **Not** a SIWE body. `/refresh` has no `verifyAuthSchema` |
| SIWE nonce | One-time, TTL 5 minutes, stored in `AuthNonce` (Postgres) so multiple API processes can consume the same issued nonce |

Auth routes (`/api/auth`):

- `POST /nonce` — persist nonce, return it
- `POST /verify` — SIWE message + signature in JSON body; set refresh cookie; return access token + address + chainId
- `POST /refresh` — cookie only; rotate refresh; reuse of a revoked token revokes the **session**
- `POST /logout` — revoke session if cookie present; always clear cookie

One nonce = one successful verify. Two browser tabs can both log in only if each called `/nonce`. Same-origin tabs share the refresh cookie; the later verify overwrites it.

Env required for boot: `SIWE_DOMAIN`, `SIWE_URI` (CORS origin is that URL’s origin), `SIWE_ALLOWED_CHAIN_IDS`, `JWT_ACCESS_SECRET`. Optional: `ADMIN_ADDRESS`, `WORKER_API_KEY`.

---

## HTTP envelope

Success (`sendSuccess`):

```json
{ "success": true, "data": <payload>, "message": "<optional>" }
```

Error (`errorHandler`):

```json
{ "success": false, "message": "<string>", "details": <optional> }
```

Do not wrap success in `{ body: ... }`.

---

## Modules and routes

All JSON APIs except `/health` sit under `/api` and use the global rate limiter. Authenticated routes take a Bearer access token unless noted.

| Module | Base | Notes |
|---|---|---|
| tokens | `/api/tokens` | GET list / GET `:address?chainId=` (active only). POST admin: create **or reactivate** inactive row. Active duplicate → 409 |
| prices | `/api/prices` | GET list / GET `:address?chainId=`. PUT `:address?chainId=` body `{ priceUsd }` — **worker key or admin** |
| pools | `/api/pools` | GET list / GET `:address?chainId=` (active pool + active tokens). POST admin create. PUT `:address?chainId=` reserves/supply/`isActive` — **worker key or admin** |
| portfolio | `/api/portfolio/me` | LP + staked LP, merged per pool, valued in USD |
| swaps | `/api/swaps/me`, `/api/swaps/:txHash?chainId=` | Wallet-scoped projection |
| liquidity | `/api/liquidity/me`, `/events/me`, `/events/:txHash?chainId=` | Positions with `lpTokenAmount > 0` |
| staking | `/api/staking` farms; `/me` positions; `/events/*`; POST farm admin | |
| analytics | `/api/analytics/{tvl,volume,liquidity,overview}` | 24h window where applicable |

Worker-or-admin: header `x-worker-key` must match `WORKER_API_KEY` (timing-safe via SHA-256 then `timingSafeEqual`). If that header is absent, fall back to Bearer JWT + `ADMIN` role. Worker path does **not** set `req.auth`.

---

## Protocol accounting (read this before touching portfolio/pools)

**Chain owns:** balances, LP ownership, pool reserves, totalSupply, farm stakes, events.

**API owns:** allowlisted tokens/pools/farms, latest USD price cache, sessions, indexed rows for `/me` and analytics.

### Pools

On create, **canonicalize** `token0Address < token1Address` (lowercase hex string order) and swap `reserve0`/`reserve1` to match. Unique `(chainId, address)` and `(chainId, token0Id, token1Id, feeBps)`. DB check: `token0Id <> token1Id`.

Reserves and `totalSupply` are **not** updated by user traffic. They are meant to be polled/written by a future indexer/worker via `PUT /api/pools/:address`. Until that writer exists, portfolio/TVL stay stale after admin create (defaults `"0"`).

Deleting a token or pool is `onDelete: Restrict` for protocol relations so history is not cascaded away. Deactivate with `isActive` instead.

### LP valuation (Uniswap-style)

```
amount0 = lpTokenAmount / totalSupply * reserve0
amount1 = lpTokenAmount / totalSupply * reserve1
valueUsd = amount0 * price0 + amount1 * price1
```

Use Prisma `Decimal`, never `Number()`, for money and reserves.

Portfolio (`getUserPortfolio`):

1. Load wallet LP positions and staking positions (`stakedAmount` treated as LP of `farm.pool`).
2. **Merge by `chainId + pool.address`** so unstaked + staked in the same pool are one position (avoids double count if the indexer keeps them split correctly; if the indexer copies instead of moving, this still adds — indexer must move LP out of `LiquidityPosition` when staking).
3. Missing price → `Decimal(0)` USD, **still show the position**.
4. `totalSupply === 0` while LP remains → **500** `Pool total supply is zero` with `{ address, chainId }` in `details`. Do not silently value as $0.

### Prices

`TokenPrice` is a **latest USD snapshot**, one row per token, not tick history or TWAP. `getPrice` 404s if inactive/unpriced. `getPriceUsdOrZero` returns 0 and is what portfolio uses.

24h analytics volume/liquidity multiply **historical event amounts by the current cache**, not trade-time price. That is accepted until the indexer snapshots prices onto events.

24h liquidity metric is **ADD minus REMOVE** (not both as inflow).

### Amounts and hashes

- Decimals: `@db.Decimal(36, 18)`, validated with `nonNegativeDecimalSchema` (string, no leading zeros, finite `Decimal`).
- `txHash` optional until confirmed. Store `null` for pending, never `""`. DB check: `NULL` or `^0x[a-f0-9]{64}$`. Unique `(chainId, txHash)` — Postgres allows multiple NULLs.

---

## Prisma / schema notes

Schema: `apps/api/prisma/schema.prisma`. Config: `apps/api/prisma.config.ts`.

Important models: `Wallet`, `RefreshSession` / `RefreshToken`, `AuthNonce`, `Token`, `TokenPrice`, `Pool`, `Swap`, `LiquidityPosition`, `LiquidityEvent`, `StakingFarm`, `StakingPosition`, `StakingEvent`.

**Dropped:** `User`, `WalletBalance` (portfolio is LP-based, not a wallet-balance table).

Migration `20261010110000_protocol_integrity` adds `auth_nonce`, drops `wallet_balances`, Restrict FKs, pair unique, txHash checks. **Apply with `npx prisma migrate dev` from `apps/api` before relying on it in a live DB.**

Older migrations still mention `userId` in places; the **current schema uses `walletId`**. If migrate history and a local DB diverge, inspect before rewriting FKs.

Generated client: import Role/enums from `apps/api/app/generated/prisma/enums` (or `client.js` as existing files do). Do not assume `@prisma/client` model types.

---

## Source-of-truth split (what not to duplicate)

Do **not** have the API mint LP, invent reserves, or treat Postgres as the AMM. The API:

- Allowlists tokens / pools / farms (admin POST)
- Serves projections for the dapp (`/me`)
- Caches latest USD
- Issues sessions

Indexer (future) should: listen to chain events, upsert swaps/LP/staking rows, poll pool reserves/supply (~1 min was the agreed cadence — not hourly-only, not “skip if <5%”), dispatch jobs. Worker (future) should: prices, rewards, notifications. Neither should be an Express app.

Until those exist, `/me` and analytics are **empty unless someone writes rows**. That is expected, not an API bug.

---

## Conventions to keep

- Module folder: `controller`, `service`, `repository`, `router`, `dto`, `types`, mappers where DTOs differ from Prisma.
- Filter `/me` by `wallet: { address }` from `req.auth.address`, never by a body address (that would let anyone read anyone).
- GET pool/token/farm 404 if the entity **or** a related token is inactive.
- `internalServerError(message, details?)` — two args are valid; use them for fail-loud cases.
- Prefer extending a module over rewriting it.

---

## Still open (do not “fix” unless asked)

- No indexer / worker processes
- No vaults module
- 24h volume not trade-time priced
- `chainId` denormalized on positions/events (can drift from `pool.chainId`)
- Vitest leftover in `apps/api/package.json`; test files were removed on request
- Frontend may still need to consume the flattened `{ success, data }` envelope
- Schema migrate for `protocol_integrity` may not have been applied on every environment
