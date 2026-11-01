-- CreateEnum
CREATE TYPE "VaultEventType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'REBALANCE', 'HANDLE_FEES');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SWAP', 'LIQUIDITY', 'STAKING', 'VAULT_DEPOSIT', 'VAULT_WITHDRAW', 'VAULT_REBALANCE', 'VAULT_FEES', 'REWARD');

-- CreateTable
CREATE TABLE "cl_vaults" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "managerAddress" TEXT NOT NULL,
    "swapRouterAddress" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "tickLower" INTEGER NOT NULL,
    "tickUpper" INTEGER NOT NULL,
    "tokenId" TEXT NOT NULL DEFAULT '0',
    "liquidity" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "amount0" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "amount1" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "totalSupply" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "sqrtPriceX96" TEXT NOT NULL DEFAULT '0',
    "currentTick" INTEGER NOT NULL DEFAULT 0,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cl_vaults_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cl_vaults_tick_order_check" CHECK ("tickLower" < "tickUpper")
);

-- CreateTable
CREATE TABLE "vault_positions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "shares" DECIMAL(36,18) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_events" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "type" "VaultEventType" NOT NULL,
    "amount0" DECIMAL(36,18) NOT NULL,
    "amount1" DECIMAL(36,18) NOT NULL,
    "shares" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "liquidity" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "oldTickLower" INTEGER,
    "oldTickUpper" INTEGER,
    "newTickLower" INTEGER,
    "newTickUpper" INTEGER,
    "txHash" TEXT,
    "status" "SwapStatus" NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vault_events_tx_hash_format_check" CHECK ("txHash" IS NULL OR "txHash" ~ '^0x[a-f0-9]{64}$')
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "txHash" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexer_cursors" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "lastBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexer_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cl_vaults_poolId_idx" ON "cl_vaults"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "cl_vaults_chainId_address_key" ON "cl_vaults"("chainId", "address");

-- CreateIndex
CREATE INDEX "vault_positions_walletId_idx" ON "vault_positions"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "vault_positions_walletId_vaultId_key" ON "vault_positions"("walletId", "vaultId");

-- CreateIndex
CREATE INDEX "vault_events_walletId_idx" ON "vault_events"("walletId");

-- CreateIndex
CREATE INDEX "vault_events_vaultId_idx" ON "vault_events"("vaultId");

-- CreateIndex
CREATE UNIQUE INDEX "vault_events_chainId_txHash_key" ON "vault_events"("chainId", "txHash");

-- CreateIndex
CREATE INDEX "notifications_walletId_isRead_idx" ON "notifications"("walletId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "indexer_cursors_chainId_contractAddress_key" ON "indexer_cursors"("chainId", "contractAddress");

-- AddForeignKey
ALTER TABLE "cl_vaults" ADD CONSTRAINT "cl_vaults_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_positions" ADD CONSTRAINT "vault_positions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_positions" ADD CONSTRAINT "vault_positions_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "cl_vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_events" ADD CONSTRAINT "vault_events_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vault_events" ADD CONSTRAINT "vault_events_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "cl_vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
