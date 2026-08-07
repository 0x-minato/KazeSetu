-- CreateTable
CREATE TABLE "pools" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "token0Id" TEXT NOT NULL,
    "token1Id" TEXT NOT NULL,
    "feeBps" INTEGER NOT NULL,
    "reserve0" DECIMAL(36,18) NOT NULL,
    "reserve1" DECIMAL(36,18) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pools_token0Id_idx" ON "pools"("token0Id");

-- CreateIndex
CREATE INDEX "pools_token1Id_idx" ON "pools"("token1Id");

-- CreateIndex
CREATE UNIQUE INDEX "pools_chainId_address_key" ON "pools"("chainId", "address");

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_token0Id_fkey" FOREIGN KEY ("token0Id") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_token1Id_fkey" FOREIGN KEY ("token1Id") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
