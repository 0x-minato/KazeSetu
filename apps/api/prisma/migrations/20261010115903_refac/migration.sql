/*
  Warnings:

  - You are about to drop the column `userId` on the `liquidity_events` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `liquidity_positions` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `refresh_session` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `staking_events` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `staking_positions` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `swaps` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `wallet` table. All the data in the column will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[walletId,poolId]` on the table `liquidity_positions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[walletId,farmId]` on the table `staking_positions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `walletId` to the `liquidity_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walletId` to the `liquidity_positions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalSupply` to the `pools` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walletId` to the `refresh_session` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walletId` to the `staking_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walletId` to the `staking_positions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walletId` to the `swaps` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "liquidity_events" DROP CONSTRAINT "liquidity_events_userId_fkey";

-- DropForeignKey
ALTER TABLE "liquidity_positions" DROP CONSTRAINT "liquidity_positions_userId_fkey";

-- DropForeignKey
ALTER TABLE "refresh_session" DROP CONSTRAINT "refresh_session_userId_fkey";

-- DropForeignKey
ALTER TABLE "staking_events" DROP CONSTRAINT "staking_events_userId_fkey";

-- DropForeignKey
ALTER TABLE "staking_positions" DROP CONSTRAINT "staking_positions_userId_fkey";

-- DropForeignKey
ALTER TABLE "swaps" DROP CONSTRAINT "swaps_userId_fkey";

-- DropForeignKey
ALTER TABLE "wallet" DROP CONSTRAINT "wallet_userId_fkey";

-- DropIndex
DROP INDEX "liquidity_events_userId_idx";

-- DropIndex
DROP INDEX "liquidity_positions_userId_idx";

-- DropIndex
DROP INDEX "liquidity_positions_userId_poolId_key";

-- DropIndex
DROP INDEX "refresh_session_userId_idx";

-- DropIndex
DROP INDEX "staking_events_userId_idx";

-- DropIndex
DROP INDEX "staking_positions_userId_farmId_key";

-- DropIndex
DROP INDEX "staking_positions_userId_idx";

-- DropIndex
DROP INDEX "swaps_userId_idx";

-- DropIndex
DROP INDEX "wallet_userId_idx";

-- AlterTable
ALTER TABLE "liquidity_events" DROP COLUMN "userId",
ADD COLUMN     "walletId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "liquidity_positions" DROP COLUMN "userId",
ADD COLUMN     "walletId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "pools" ADD COLUMN     "totalSupply" DECIMAL(36,18) NOT NULL;

-- AlterTable
ALTER TABLE "refresh_session" DROP COLUMN "userId",
ADD COLUMN     "walletId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "staking_events" DROP COLUMN "userId",
ADD COLUMN     "walletId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "staking_positions" DROP COLUMN "userId",
ADD COLUMN     "walletId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "swaps" DROP COLUMN "userId",
ADD COLUMN     "walletId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "wallet" DROP COLUMN "userId",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE "users";

-- CreateIndex
CREATE INDEX "liquidity_events_walletId_idx" ON "liquidity_events"("walletId");

-- CreateIndex
CREATE INDEX "liquidity_positions_walletId_idx" ON "liquidity_positions"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidity_positions_walletId_poolId_key" ON "liquidity_positions"("walletId", "poolId");

-- CreateIndex
CREATE INDEX "refresh_session_walletId_idx" ON "refresh_session"("walletId");

-- CreateIndex
CREATE INDEX "staking_events_walletId_idx" ON "staking_events"("walletId");

-- CreateIndex
CREATE INDEX "staking_positions_walletId_idx" ON "staking_positions"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "staking_positions_walletId_farmId_key" ON "staking_positions"("walletId", "farmId");

-- CreateIndex
CREATE INDEX "swaps_walletId_idx" ON "swaps"("walletId");

-- AddForeignKey
ALTER TABLE "refresh_session" ADD CONSTRAINT "refresh_session_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swaps" ADD CONSTRAINT "swaps_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidity_positions" ADD CONSTRAINT "liquidity_positions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidity_events" ADD CONSTRAINT "liquidity_events_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staking_positions" ADD CONSTRAINT "staking_positions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staking_events" ADD CONSTRAINT "staking_events_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
