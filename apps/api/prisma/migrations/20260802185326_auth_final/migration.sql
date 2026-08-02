/*
  Warnings:

  - You are about to drop the column `userId` on the `refresh_token` table. All the data in the column will be lost.
  - Added the required column `expiresAt` to the `refresh_session` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "refresh_token" DROP CONSTRAINT "refresh_token_userId_fkey";

-- DropIndex
DROP INDEX "refresh_token_userId_idx";

-- AlterTable
ALTER TABLE "refresh_session" ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "refresh_token" DROP COLUMN "userId";

-- CreateIndex
CREATE INDEX "refresh_session_expiresAt_idx" ON "refresh_session"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_token_sessionId_idx" ON "refresh_token"("sessionId");
