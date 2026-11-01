import { API_BASE_URL, WORKER_API_KEY } from "../config/env.js"
import type { NotificationJobPayload } from "../../../../packages/shared/src/index.ts"

export interface ApiEnvelope<T> {
  success: boolean
  data: T
  message?: string
}

export interface ApiTokenItem {
  address: string
  chainId: number
  name: string
  symbol: string
  decimals: number
  isActive: boolean
}

export interface ApiPoolItem {
  address: string
  chainId: number
  feeBps: number
  reserve0: string
  reserve1: string
  totalSupply: string
  token0: ApiTokenItem
  token1: ApiTokenItem
}

export interface ApiVaultItem {
  address: string
  chainId: number
  name: string
  symbol: string
  fee: number
  tickLower: number
  tickUpper: number
  currentTick: number
  sqrtPriceX96: string
  tokenId: string
  liquidity: string
  amount0: string
  amount1: string
  totalSupply: string
  isPaused: boolean
  isActive: boolean
  managerAddress: string
  swapRouterAddress: string
  pool: ApiPoolItem
}

export interface UpdatePoolStateInput {
  reserve0: string
  reserve1: string
  totalSupply: string
  isActive?: boolean
}

export interface UpdateVaultStateInput {
  tickLower?: number
  tickUpper?: number
  currentTick?: number
  sqrtPriceX96?: string
  tokenId?: string
  liquidity: string
  amount0: string
  amount1: string
  totalSupply: string
  isPaused?: boolean
  isActive?: boolean
}

const buildHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  if (WORKER_API_KEY) {
    headers["x-worker-key"] = WORKER_API_KEY
  }
  return headers
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
  const response = await fetch(url, {
    ...init,
    headers: {
      ...buildHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(
      `API request failed: ${init.method ?? "GET"} ${path} -> ${response.status} ${errorText}`,
    )
  }

  const json = (await response.json()) as ApiEnvelope<T>
  if (!json.success) {
    throw new Error(
      `API returned unsuccessful envelope for ${path}: ${json.message ?? "Unknown error"}`,
    )
  }

  return json.data
}

export const workerApiClient = {
  getTokens: (): Promise<ApiTokenItem[]> => request<ApiTokenItem[]>("/api/tokens"),

  getPools: (): Promise<ApiPoolItem[]> => request<ApiPoolItem[]>("/api/pools"),

  getVaults: (): Promise<ApiVaultItem[]> => request<ApiVaultItem[]>("/api/vaults"),

  updateTokenPrice: (
    address: string,
    chainId: number,
    priceUsd: string,
  ): Promise<unknown> =>
    request(
      `/api/prices/${encodeURIComponent(address.toLowerCase())}?chainId=${chainId}`,
      {
        method: "PUT",
        body: JSON.stringify({ priceUsd }),
      },
    ),

  updatePoolState: (
    address: string,
    chainId: number,
    state: UpdatePoolStateInput,
  ): Promise<unknown> =>
    request(
      `/api/pools/${encodeURIComponent(address.toLowerCase())}?chainId=${chainId}`,
      {
        method: "PUT",
        body: JSON.stringify(state),
      },
    ),

  updateVaultState: (
    address: string,
    chainId: number,
    state: UpdateVaultStateInput,
  ): Promise<unknown> =>
    request(
      `/api/vaults/${encodeURIComponent(address.toLowerCase())}?chainId=${chainId}`,
      {
        method: "PUT",
        body: JSON.stringify(state),
      },
    ),

  createNotification: (payload: NotificationJobPayload): Promise<unknown> =>
    request("/api/notifications", {
      method: "POST",
      body: JSON.stringify({
        notification: {
          walletAddress: payload.walletAddress.toLowerCase(),
          chainId: payload.chainId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          txHash: payload.txHash ? payload.txHash.toLowerCase() : null,
        },
      }),
    }),
}
