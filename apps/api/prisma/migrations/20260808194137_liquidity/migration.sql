-- CreateEnum
CREATE TYPE "LiquidityEventType" AS ENUM ('ADD', 'REMOVE');

-- CreateTable
CREATE TABLE "liquidity_positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "lpTokenAmount" DECIMAL(36,18) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidity_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidity_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "type" "LiquidityEventType" NOT NULL,
    "amount0" DECIMAL(36,18) NOT NULL,
    "amount1" DECIMAL(36,18) NOT NULL,
    "lpAmount" DECIMAL(36,18) NOT NULL,
    "txHash" TEXT,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "liquidity_positions_userId_idx" ON "liquidity_positions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidity_positions_userId_poolId_key" ON "liquidity_positions"("userId", "poolId");

-- CreateIndex
CREATE INDEX "liquidity_events_userId_idx" ON "liquidity_events"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidity_events_chainId_txHash_key" ON "liquidity_events"("chainId", "txHash");

-- AddForeignKey
ALTER TABLE "liquidity_positions" ADD CONSTRAINT "liquidity_positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidity_positions" ADD CONSTRAINT "liquidity_positions_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidity_events" ADD CONSTRAINT "liquidity_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidity_events" ADD CONSTRAINT "liquidity_events_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
