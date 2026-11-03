# KazeSetu

> Institutional Concentrated Liquidity & DeFi Portfolio Platform

**KazeSetu** is a full-stack, end-to-end Web3 & DeFi platform combining **Uniswap V3 Concentrated Liquidity Vaults (`KazeClVault`)**, **Canonical AMM Pools & Yield Farms**, a **Modular Express 5 + Prisma 7 API**, a **Viem Blockchain Event Indexer**, **BullMQ + Redis Background Workers**, and a **Next.js 15 Institutional Terminal**.

---

## System Architecture

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        EVM Blockchain / Uniswap V3                         │
│     KazeClVault (UUPS)  ·  UniswapV3Pool  ·  StakingFarm  ·  ERC20         │
└───────────────┬────────────────────────────────────────▲───────────────────┘
                │ Events & RPC State                     │ Direct On-Chain Tx
                ▼ (viem getLogs / readContract)          │ (viem WalletClient)
┌───────────────────────────────┐        ┌───────────────┴───────────────────┐
│   apps/indexer (Event Sync)   │        │     apps/web (Next.js 15 UI)      │
│  • Indexes Vault/Pool/Farm    │        │  • SIWE (EIP-4361) Auth           │
│  • Updates PostgreSQL         │        │  • CL Vaults / Pools / Staking    │
│  • Dispatches BullMQ Jobs     │        │  • Portfolio & TxHash Inspector   │
└───────┬───────────────┬───────┘        └───────────────┬───────────────────┘
        │               │ Enqueue Jobs                   │ REST ({success,data})
        │               ▼                                ▼
        │       ┌───────────────────────────────┐ ┌──────────────────────────┐
        │       │     Redis 7 + BullMQ          │ │  apps/api (Express 5)    │
        │       │  • kazesetu-notifications     │ │  • SIWE + Rotating JWT   │
        │       │  • kazesetu-protocol-sync     │ │  • Portfolio & Vaults    │
        │       │  • kazesetu-rewards           │ │  • Analytics & Oracle    │
        │       └───────────────┬───────────────┘ └──────▲───────────┬───────┘
        │                       │ Consume & Cron (60s)   │           │
        │                       ▼                        │           │
        │               ┌───────────────────────────────┐│           │
        │               │  apps/worker (BullMQ Worker)  ├┘           │
        │               │  • DefiLlama Price Oracle     │ (x-worker-key)
        │               │  • On-chain Reserve/Vault Sync│            │
        │               │  • Rebalance & Reward Alerts  │            │
        │               └───────────────┬───────────────┘            │
        ▼                               ▼                            ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  PostgreSQL 16 (Prisma 7 Decimal(36,18))                   │
│   Wallet · ClVault · VaultPosition · Pool · Swap · Staking · Notification  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```text
KazeSetu/
├── apps/
│   ├── api/                  # Express 5 + Prisma 7 modular monolith API (port 3001)
│   ├── indexer/              # Viem blockchain event indexer + BullMQ job producer
│   ├── worker/               # BullMQ background job processor + 60s repeatable scheduler
│   └── web/                  # Next.js 15 + React 19 + Viem frontend terminal (port 5173)
├── packages/
│   └── shared/               # @kazesetu/shared: ABIs, CL tick/liquidity math, BullMQ queues
├── contracts/                # Foundry / Solidity 0.8.27 (KazeClVault UUPS, TickMath, LiquidityAmounts)
├── docker/                   # Production Dockerfiles for api, indexer, worker, and web
├── docs/                     # Service-by-service engineering documentation
├── docker-compose.yml        # PostgreSQL 16 + Redis 7 + optional full-stack containers
└── package.json              # Root workspace scripts
```

---

## Service Documentation (`docs/`)

Detailed architecture, math specifications, endpoint tables, and runbooks are documented per service:

- [**Smart Contracts (`contracts/`)**](./docs/contracts.md) — `KazeClVault` UUPS architecture, single-sided auto-zap math, fee compounding (`handle_fees`), out-of-range `rebalance`, Foundry tests, and deployment script.
- [**Backend API (`apps/api/`)**](./docs/api.md) — Modular monolith layers, SIWE (EIP-4361) + rotating refresh cookie security, `x-worker-key` auth, portfolio & CL vault valuation math, and full REST endpoint reference.
- [**Blockchain Event Indexer (`apps/indexer/`)**](./docs/indexer.md) — Viem log polling, `IndexerCursor` block persistence, `KazeClVault` / `Pool` / `StakingFarm` synchronization, and atomic LP stake/unstake accounting.
- [**Background Worker & BullMQ (`apps/worker/`)**](./docs/worker.md) — Queue processors (`kazesetu-notifications`, `kazesetu-protocol-sync`, `kazesetu-rewards`), DefiLlama price oracle sync, and out-of-range governor alerts.
- [**Web Terminal (`apps/web/`)**](./docs/web.md) — Next.js 15 + TanStack Query state architecture, EIP-6963 wallet discovery, SIWE flow, and direct `viem` on-chain contract write execution.
- [**Docker & Infrastructure (`docker/`)**](./docs/docker.md) — Local Postgres/Redis setup and full-stack multi-container deployment (`--profile full`).
- [**Agent & Engineering Context**](./docs/agent-context.md) — Deep architectural invariants and conventions.

---

## Quick Start (End-to-End Local Setup)

### 1. Start PostgreSQL 16 & Redis 7
```bash
cp .env.example .env
docker compose up -d
```

### 2. Install Dependencies, Migrate Database & Seed Protocol Data
```bash
cd apps/api && npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 3. Start All Services
From the root directory (in separate terminals):
```bash
npm run dev:api       # Express API on http://localhost:3001
npm run dev:web       # Next.js Terminal on http://localhost:5173
npm run dev:indexer   # Viem Blockchain Event Indexer
npm run dev:worker    # BullMQ Background Worker & 60s Scheduler
```

### 4. Run Smart Contract Tests (Foundry)
```bash
cd contracts
forge test --match-path test/KazeClVault.t.sol -vvv
```

---

## License

MIT
