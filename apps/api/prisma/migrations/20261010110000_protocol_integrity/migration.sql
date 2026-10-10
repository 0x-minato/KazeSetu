-- Drop unused wallet-balance projection
DROP TABLE IF EXISTS "wallet_balances";

-- Persist SIWE nonces so multiple API instances share one-time values
CREATE TABLE "auth_nonce" (
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_nonce_pkey" PRIMARY KEY ("nonce")
);

CREATE INDEX "auth_nonce_expiresAt_idx" ON "auth_nonce"("expiresAt");

-- Canonical pool pair uniqueness after token0 < token1 ordering
CREATE UNIQUE INDEX "pools_chainId_token0Id_token1Id_feeBps_key"
ON "pools"("chainId", "token0Id", "token1Id", "feeBps");

ALTER TABLE "pools"
ADD CONSTRAINT "pools_distinct_tokens"
CHECK ("token0Id" <> "token1Id");

-- Pending events keep txHash NULL; reject empty-string placeholders
UPDATE "swaps" SET "txHash" = NULL WHERE "txHash" = '';
UPDATE "liquidity_events" SET "txHash" = NULL WHERE "txHash" = '';
UPDATE "staking_events" SET "txHash" = NULL WHERE "txHash" = '';

ALTER TABLE "swaps"
ADD CONSTRAINT "swaps_txHash_format"
CHECK ("txHash" IS NULL OR "txHash" ~ '^0x[a-f0-9]{64}$');

ALTER TABLE "liquidity_events"
ADD CONSTRAINT "liquidity_events_txHash_format"
CHECK ("txHash" IS NULL OR "txHash" ~ '^0x[a-f0-9]{64}$');

ALTER TABLE "staking_events"
ADD CONSTRAINT "staking_events_txHash_format"
CHECK ("txHash" IS NULL OR "txHash" ~ '^0x[a-f0-9]{64}$');

-- Deleting a token or pool must not wipe protocol history
ALTER TABLE "pools" DROP CONSTRAINT "pools_token0Id_fkey";
ALTER TABLE "pools" ADD CONSTRAINT "pools_token0Id_fkey"
FOREIGN KEY ("token0Id") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pools" DROP CONSTRAINT "pools_token1Id_fkey";
ALTER TABLE "pools" ADD CONSTRAINT "pools_token1Id_fkey"
FOREIGN KEY ("token1Id") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "swaps" DROP CONSTRAINT "swaps_poolId_fkey";
ALTER TABLE "swaps" ADD CONSTRAINT "swaps_poolId_fkey"
FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "swaps" DROP CONSTRAINT "swaps_tokenInId_fkey";
ALTER TABLE "swaps" ADD CONSTRAINT "swaps_tokenInId_fkey"
FOREIGN KEY ("tokenInId") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "swaps" DROP CONSTRAINT "swaps_tokenOutId_fkey";
ALTER TABLE "swaps" ADD CONSTRAINT "swaps_tokenOutId_fkey"
FOREIGN KEY ("tokenOutId") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "liquidity_positions" DROP CONSTRAINT "liquidity_positions_poolId_fkey";
ALTER TABLE "liquidity_positions" ADD CONSTRAINT "liquidity_positions_poolId_fkey"
FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "liquidity_events" DROP CONSTRAINT "liquidity_events_poolId_fkey";
ALTER TABLE "liquidity_events" ADD CONSTRAINT "liquidity_events_poolId_fkey"
FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staking_farms" DROP CONSTRAINT "staking_farms_poolId_fkey";
ALTER TABLE "staking_farms" ADD CONSTRAINT "staking_farms_poolId_fkey"
FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "staking_farms" DROP CONSTRAINT "staking_farms_rewardTokenId_fkey";
ALTER TABLE "staking_farms" ADD CONSTRAINT "staking_farms_rewardTokenId_fkey"
FOREIGN KEY ("rewardTokenId") REFERENCES "tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
