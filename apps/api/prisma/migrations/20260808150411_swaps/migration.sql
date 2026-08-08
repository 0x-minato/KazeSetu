/*
  Warnings:

  - You are about to drop the column `updateAt` on the `pools` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `pools` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('SUCCESS', 'PENDING', 'FAILED');

-- AlterTable
ALTER TABLE "pools" DROP COLUMN "updateAt",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "swaps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "poolId" TEXT NOT NULL,
    "tokenInId" TEXT NOT NULL,
    "tokenOutId" TEXT NOT NULL,
    "amountIn" DECIMAL(36,18) NOT NULL,
    "amountOut" DECIMAL(36,18) NOT NULL,
    "txHash" TEXT,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "swaps_userId_idx" ON "swaps"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "swaps_chainId_txHash_key" ON "swaps"("chainId", "txHash");

-- AddForeignKey
ALTER TABLE "swaps" ADD CONSTRAINT "swaps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swaps" ADD CONSTRAINT "swaps_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swaps" ADD CONSTRAINT "swaps_tokenInId_fkey" FOREIGN KEY ("tokenInId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swaps" ADD CONSTRAINT "swaps_tokenOutId_fkey" FOREIGN KEY ("tokenOutId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
