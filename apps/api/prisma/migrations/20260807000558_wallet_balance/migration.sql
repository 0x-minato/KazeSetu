-- CreateTable
CREATE TABLE "wallet_balances" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_balances_walletId_idx" ON "wallet_balances"("walletId");

-- CreateIndex
CREATE INDEX "wallet_balances_tokenId_idx" ON "wallet_balances"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_balances_walletId_tokenId_key" ON "wallet_balances"("walletId", "tokenId");

-- AddForeignKey
ALTER TABLE "wallet_balances" ADD CONSTRAINT "wallet_balances_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_balances" ADD CONSTRAINT "wallet_balances_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
