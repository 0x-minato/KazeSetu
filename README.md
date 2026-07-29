# KazeSetu

> Production-grade DeFi Portfolio & Liquidity Platform

KazeSetu is a full-stack DeFi platform built to demonstrate how a modern Web3 startup engineers its backend infrastructure.

Instead of focusing only on smart contracts, the project emphasizes scalable backend architecture, distributed systems, blockchain event indexing, portfolio management, transaction processing, caching, and production-ready engineering practices.

The project is built incrementally, beginning with a backend-first approach before integrating Solidity smart contracts.

---

## Features

* 🔐 Sign-In with Ethereum (SIWE)
* 📊 Portfolio Management
* 💱 Token Swaps
* 🌊 Liquidity Pools
* 🪙 LP Staking & Rewards
* 📈 Protocol Analytics
* 🔔 Notifications
* ⚡ Background Workers
* ⛓️ Blockchain Event Indexer

---

## Tech Stack

### Frontend

* Next.js
* TypeScript
* TanStack Query
* Tailwind CSS
* Wagmi
* Viem

### Backend

* Express.js
* TypeScript
* PostgreSQL
* Prisma ORM
* Redis
* BullMQ

### Smart Contracts

* Solidity
* Foundry

### Infrastructure

* Docker
* Docker Compose

---

## Repository Structure

```text
kazesetu/

apps/
├── api/          # Express Backend
├── web/          # Next.js Frontend
├── worker/       # BullMQ Workers
└── indexer/      # Blockchain Event Indexer

contracts/        # Solidity Contracts

packages/         # Shared packages

docker/           # Docker configuration

docs/             # Project documentation
```

---

## Getting Started

Clone the repository

```bash
git clone https://github.com/<your-username>/kazesetu.git
```

Install dependencies

```bash
pnpm install
```

Start local infrastructure

```bash
docker compose up -d
```

Run development servers

```bash
pnpm dev
```

---

## Documentation

Detailed documentation is available in the `docs/` directory.

* Product Vision
* System Architecture
* Database Design
* API Design
* Smart Contract Design
* Deployment

---

## Project Status

🚧 Active Development

The project is being built in multiple phases:

* Backend Infrastructure
* Portfolio Engine
* Swap Engine
* Liquidity Engine
* Smart Contracts
* Blockchain Indexer
* Production Deployment

---

## License

MIT