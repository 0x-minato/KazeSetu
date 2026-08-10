-- CreateEnum
CREATE TYPE "StakingEventType" AS ENUM ('STAKE', 'UNSTAKE', 'CLAIM');

-- CreateTable
CREATE TABLE "staking_farms" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "poolId" TEXT NOT NULL,
    "rewardTokenId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staking_farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staking_positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "stakedAmount" DECIMAL(36,18) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staking_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staking_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "type" "StakingEventType" NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "txHash" TEXT,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staking_farms_poolId_idx" ON "staking_farms"("poolId");

-- CreateIndex
CREATE INDEX "staking_farms_rewardTokenId_idx" ON "staking_farms"("rewardTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "staking_farms_chainId_address_key" ON "staking_farms"("chainId", "address");

-- CreateIndex
CREATE INDEX "staking_positions_userId_idx" ON "staking_positions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staking_positions_userId_farmId_key" ON "staking_positions"("userId", "farmId");

-- CreateIndex
CREATE INDEX "staking_events_userId_idx" ON "staking_events"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staking_events_chainId_txHash_key" ON "staking_events"("chainId", "txHash");

-- AddForeignKey
ALTER TABLE "staking_farms" ADD CONSTRAINT "staking_farms_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staking_farms" ADD CONSTRAINT "staking_farms_rewardTokenId_fkey" FOREIGN KEY ("rewardTokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staking_positions" ADD CONSTRAINT "staking_positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staking_positions" ADD CONSTRAINT "staking_positions_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "staking_farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staking_events" ADD CONSTRAINT "staking_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staking_events" ADD CONSTRAINT "staking_events_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "staking_farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
