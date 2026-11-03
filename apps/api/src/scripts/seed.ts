import "dotenv/config"
import { prisma } from "../config/database"

const CHAIN_ID = Number(process.env.SEED_CHAIN_ID ?? 1)

async function main() {
  console.log(`[seed] Seeding KazeSetu protocol projection on chain ${CHAIN_ID}...`)

  // 1. Canonical Allowlisted Tokens (lowercase addresses)
  const tokenSpecs = [
    {
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priceUsd: "1.00",
    },
    {
      address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      priceUsd: "3250.00",
    },
    {
      address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
      symbol: "WBTC",
      name: "Wrapped BTC",
      decimals: 8,
      priceUsd: "94500.00",
    },
    {
      address: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
      symbol: "KAZE",
      name: "KazeSetu Governance Token",
      decimals: 18,
      priceUsd: "4.85",
    },
  ]

  const tokenBySymbol = new Map<string, { id: string; address: string }>()

  for (const spec of tokenSpecs) {
    const token = await prisma.token.upsert({
      where: {
        chainId_address: {
          chainId: CHAIN_ID,
          address: spec.address,
        },
      },
      update: {
        symbol: spec.symbol,
        name: spec.name,
        decimals: spec.decimals,
        isActive: true,
      },
      create: {
        chainId: CHAIN_ID,
        address: spec.address,
        symbol: spec.symbol,
        name: spec.name,
        decimals: spec.decimals,
        isActive: true,
      },
    })

    await prisma.tokenPrice.upsert({
      where: { tokenId: token.id },
      update: { priceUsd: spec.priceUsd },
      create: { tokenId: token.id, priceUsd: spec.priceUsd },
    })

    tokenBySymbol.set(spec.symbol, { id: token.id, address: token.address })
  }

  const usdc = tokenBySymbol.get("USDC")!
  const weth = tokenBySymbol.get("WETH")!
  const wbtc = tokenBySymbol.get("WBTC")!
  const kaze = tokenBySymbol.get("KAZE")!

  // 2. Canonical AMM Pools (token0.address < token1.address)
  // usdc (0xa0b8...) < weth (0xc02a...)
  const usdcWethPool = await prisma.pool.upsert({
    where: {
      chainId_address: {
        chainId: CHAIN_ID,
        address: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
      },
    },
    update: {
      reserve0: "4850000",
      reserve1: "1492.307692",
      totalSupply: "85042.15",
      isActive: true,
    },
    create: {
      chainId: CHAIN_ID,
      address: "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
      token0Id: usdc.id,
      token1Id: weth.id,
      feeBps: 30,
      reserve0: "4850000",
      reserve1: "1492.307692",
      totalSupply: "85042.15",
      isActive: true,
    },
  })

  // wbtc (0x2260...) < weth (0xc02a...)
  await prisma.pool.upsert({
    where: {
      chainId_address: {
        chainId: CHAIN_ID,
        address: "0xcbcdf9626bc03e24f779434178a73a0b4bad62ed",
      },
    },
    update: {
      reserve0: "42.5",
      reserve1: "1235.76923",
      totalSupply: "229.18",
      isActive: true,
    },
    create: {
      chainId: CHAIN_ID,
      address: "0xcbcdf9626bc03e24f779434178a73a0b4bad62ed",
      token0Id: wbtc.id,
      token1Id: weth.id,
      feeBps: 30,
      reserve0: "42.5",
      reserve1: "1235.76923",
      totalSupply: "229.18",
      isActive: true,
    },
  })

  // 3. Staking Farm on USDC/WETH Pool earning KAZE
  await prisma.stakingFarm.upsert({
    where: {
      chainId_address: {
        chainId: CHAIN_ID,
        address: "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
      },
    },
    update: {
      isActive: true,
    },
    create: {
      chainId: CHAIN_ID,
      address: "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
      poolId: usdcWethPool.id,
      rewardTokenId: kaze.id,
      isActive: true,
    },
  })

  // 4. KazeClVault (Concentrated Liquidity Vault on USDC/WETH 0.3%)
  await prisma.clVault.upsert({
    where: {
      chainId_address: {
        chainId: CHAIN_ID,
        address: "0x999999cf1046e68e36e1a2e0e07105eddd1f08e0",
      },
    },
    update: {
      tickLower: 194400,
      tickUpper: 196200,
      currentTick: 195320,
      liquidity: "184500000000000",
      amount0: "650000",
      amount1: "200",
      totalSupply: "184500",
      isPaused: false,
      isActive: true,
    },
    create: {
      chainId: CHAIN_ID,
      address: "0x999999cf1046e68e36e1a2e0e07105eddd1f08e0",
      name: "Kaze USDC-WETH CL Vault",
      symbol: "kCL-USDC-WETH",
      poolId: usdcWethPool.id,
      managerAddress: "0xc36442b4a4522e871399cd717abdd847ab11fe88",
      swapRouterAddress: "0xe592427a0aece92de3edee1f18e0157c05861564",
      fee: 3000,
      tickLower: 194400,
      tickUpper: 196200,
      currentTick: 195320,
      sqrtPriceX96: "1381629945728391045120000000000000",
      tokenId: "1",
      liquidity: "184500000000000",
      amount0: "650000",
      amount1: "200",
      totalSupply: "184500",
      isPaused: false,
      isActive: true,
    },
  })

  console.log("[seed] Successfully seeded tokens, prices, pools, staking farm, and KazeClVault.")
}

main()
  .catch((err) => {
    console.error("[seed] Failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
