# Docker & Infrastructure Documentation (`docker/` & `docker-compose.yml`)

## Overview

KazeSetu includes a production-grade **Docker Compose** setup (`docker-compose.yml` and `docker/*.Dockerfile`) that supports two operating modes:

1. **Local Development Mode (Default)**: Starts **PostgreSQL 16** and **Redis 7** in Docker while you run `api`, `indexer`, `worker`, and `web` natively with hot-reload on your host machine.
2. **Full Containerized Stack Mode (`--profile full`)**: Builds and runs all 6 containers (`postgres`, `redis`, `api`, `indexer`, `worker`, `web`) on a shared internal bridge network with healthcheck dependency ordering.

---

## Directory Structure

```text
KazeSetu/
├── docker-compose.yml           # Multi-service orchestration with healthchecks & volumes
├── .dockerignore                # Excludes node_modules, .next, .env, and build caches from build context
├── .env.example                 # Root environment template for Docker Compose
└── docker/
    ├── api.Dockerfile           # Express 5 API + Prisma migration deploy on container boot
    ├── indexer.Dockerfile       # Viem blockchain event indexer container
    ├── worker.Dockerfile        # BullMQ background worker + 60s repeatable scheduler container
    └── web.Dockerfile           # Next.js 15 production build serving on port 5173
```

---

## Services Architecture

| Container | Image / Dockerfile | Host Port | Purpose |
|---|---|---|---|
| `kazesetu-postgres` | `postgres:16-alpine` | `5432` | Primary relational database for protocol projections, SIWE nonces, and sessions |
| `kazesetu-redis` | `redis:7-alpine` | `6379` | Persistent (`--appendonly yes`, `--maxmemory-policy noeviction`) broker for BullMQ queues |
| `kazesetu-api` | `docker/api.Dockerfile` | `3001` | Runs `npx prisma migrate deploy` then starts the Express API server |
| `kazesetu-indexer` | `docker/indexer.Dockerfile` | *(internal)* | Polls on-chain events (`KazeClVault`, `Pool`, `StakingFarm`), writes to Postgres, and enqueues BullMQ jobs |
| `kazesetu-worker` | `docker/worker.Dockerfile` | *(internal)* | Consumes `kazesetu-notifications`, `kazesetu-protocol-sync`, and `kazesetu-rewards` queues + runs 60s cron jobs |
| `kazesetu-web` | `docker/web.Dockerfile` | `5173` | Serves the Next.js 15 frontend application |

> **Why `--maxmemory-policy noeviction` on Redis?**
> BullMQ requires Redis to never silently evict queue keys or lock keys under memory pressure. Our `docker-compose.yml` configures Redis with AOF persistence and `noeviction` out of the box.

---

## Mode 1: Local Development (Infrastructure in Docker, Apps on Host)

### 1. Start PostgreSQL & Redis
```bash
cp .env.example .env
docker compose up -d
```
Verify both containers are healthy:
```bash
docker compose ps
```

### 2. Apply Migrations & Seed Protocol Data
```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 3. Start the Services
In separate terminals:
```bash
npm run dev:api       # Express API on http://localhost:3001
npm run dev:web       # Next.js Web on http://localhost:5173
npm run dev:indexer   # Viem Blockchain Event Indexer
npm run dev:worker    # BullMQ Background Worker & 60s Scheduler
```

---

## Mode 2: Full Containerized Deployment (`--profile full`)

To build and launch every service (`postgres`, `redis`, `api`, `indexer`, `worker`, `web`) inside Docker:

```bash
cp .env.example .env
docker compose --profile full up --build -d
```

### View Logs Across Services
```bash
# Follow all service logs
docker compose --profile full logs -f

# Follow specific service logs
docker compose logs -f api indexer worker
```

### Seed the Containerized Database
```bash
docker exec -it kazesetu-api npx tsx src/scripts/seed.ts
```

### Tear Down
```bash
# Stop containers (preserves postgres_data and redis_data volumes)
docker compose --profile full down

# Stop containers and wipe database/queue volumes
docker compose --profile full down -v
```
