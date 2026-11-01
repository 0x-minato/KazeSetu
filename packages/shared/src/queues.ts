export const QUEUE_NAMES = {
  NOTIFICATIONS: "kazesetu-notifications",
  PROTOCOL_SYNC: "kazesetu-protocol-sync",
  REWARDS: "kazesetu-rewards",
} as const

export type NotificationJobType =
  | "SWAP"
  | "LIQUIDITY"
  | "STAKING"
  | "VAULT_DEPOSIT"
  | "VAULT_WITHDRAW"
  | "VAULT_REBALANCE"
  | "VAULT_FEES"
  | "REWARD"

export interface NotificationJobPayload {
  walletAddress: string
  chainId: number
  type: NotificationJobType
  title: string
  message: string
  txHash?: string | null
}

export interface ProtocolSyncJobPayload {
  kind: "SYNC_PRICES" | "SYNC_POOLS" | "SYNC_VAULTS"
  chainId?: number
  targetAddress?: string
}

export interface RewardCalcJobPayload {
  chainId: number
  farmAddress?: string
  walletAddress?: string
  txHash?: string | null
}
