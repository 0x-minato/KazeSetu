export type Role = "USER" | "ADMIN"

export type SwapStatus = "SUCCESS" | "PENDING" | "FAILED"
export type LiquidityEventType = "ADD" | "REMOVE"
export type StakingEventType = "STAKE" | "UNSTAKE" | "CLAIM"

export interface Token {
  address: string
  chainId: number
  name: string
  symbol: string
  decimals: number
  isActive: boolean
}

export interface TokenPrice {
  address: string
  chainId: number
  symbol: string
  priceUsd: string
  updatedAt: string
}

export interface Pool {
  address: string
  chainId: number
  feeBps: number
  reserve0: string
  reserve1: string
  totalSupply: string
  token0: Token
  token1: Token
}

export interface Position {
  pool: Pool
  valueUsd: string
  amount0: string
  amount1: string
}

export interface Portfolio {
  positions: Position[]
  totalValueUsd: string
}

export interface Liquidity {
  chainId: number
  lpTokenAmount: string
  pool: Pool
}

export interface LiquidityEvent {
  chainId: number
  type: LiquidityEventType
  amount0: string
  amount1: string
  lpAmount: string
  txHash: string | null
  status: SwapStatus
  pool: Pool
  createdAt: string
}

export interface SwapData {
  chainId: number
  status: SwapStatus
  txHash: string | null
  amountIn: string
  amountOut: string
  createdAt: string
  pool: Pool
  tokenIn: Token
  tokenOut: Token
}

export interface FarmData {
  address: string
  chainId: number
  isActive: boolean
  pool: Pool
  rewardToken: Token
}

export interface StakingPosition {
  stakedAmount: string
  chainId: number
  farm: FarmData
}

export interface StakingEvent {
  chainId: number
  type: StakingEventType
  amount: string
  txHash: string | null
  status: SwapStatus
  createdAt: string
  farm: FarmData
}

export interface AnalyticsOverview {
  tvl: string
  volume: string
  liquidity: string
}

export interface AuthVerifyResult {
  address: string
  chainId: number
  accessToken: string
}
