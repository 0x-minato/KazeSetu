import type {
  AnalyticsOverview,
  AuthVerifyResult,
  FarmData,
  Liquidity,
  LiquidityEvent,
  Pool,
  Portfolio,
  StakingEvent,
  StakingPosition,
  SwapData,
  Token,
  TokenPrice,
} from "./types"

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001"

export class ApiClientError extends Error {
  readonly statusCode: number
  readonly details?: unknown

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message)
    this.statusCode = statusCode
    this.details = details
    this.name = "ApiClientError"
  }
}

type SuccessEnvelope<T> = {
  success: true
  data: T
  message?: string
}

type ErrorEnvelope = {
  success: false
  message: string
  details?: unknown
}

let accessTokenStore: string | null = null
let refreshInFlight: Promise<string | null> | null = null
const tokenListeners = new Set<(token: string | null) => void>()

export const getAccessToken = (): string | null => accessTokenStore

export const setAccessToken = (token: string | null) => {
  accessTokenStore = token
  if (typeof window !== "undefined") {
    if (token) {
      window.sessionStorage.setItem("kazesetu.accessToken", token)
    } else {
      window.sessionStorage.removeItem("kazesetu.accessToken")
    }
  }
  tokenListeners.forEach((listener) => listener(token))
}

export const hydrateStoredAccessToken = (): string | null => {
  if (typeof window === "undefined") return null
  const stored = window.sessionStorage.getItem("kazesetu.accessToken")
  if (stored) accessTokenStore = stored
  return accessTokenStore
}

export const subscribeAccessToken = (
  listener: (token: string | null) => void,
) => {
  tokenListeners.add(listener)
  return () => {
    tokenListeners.delete(listener)
  }
}

export const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) {
        setAccessToken(null)
        return null
      }
      const payload = (await res.json()) as SuccessEnvelope<string>
      if (payload.success && typeof payload.data === "string") {
        setAccessToken(payload.data)
        return payload.data
      }
      setAccessToken(null)
      return null
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  auth?: boolean
  workerKey?: string
  retryOn401?: boolean
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    body,
    auth = true,
    workerKey,
    retryOn401 = true,
    headers: customHeaders,
    ...rest
  } = options

  const headers = new Headers(customHeaders)
  if (body !== undefined) {
    headers.set("content-type", "application/json")
  }
  if (workerKey && workerKey.trim().length > 0) {
    headers.set("x-worker-key", workerKey.trim())
  }
  if (auth) {
    const token = accessTokenStore ?? hydrateStoredAccessToken()
    if (token) {
      headers.set("authorization", `Bearer ${token}`)
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (response.status === 401 && auth && retryOn401) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return apiRequest<T>(path, { ...options, retryOn401: false })
    }
  }

  let parsed: SuccessEnvelope<T> | ErrorEnvelope | null = null
  try {
    parsed = (await response.json()) as SuccessEnvelope<T> | ErrorEnvelope
  } catch {
    throw new ApiClientError(
      response.status,
      `HTTP ${response.status} from ${path}`,
    )
  }

  if (!response.ok || !parsed || parsed.success === false) {
    const errPayload = parsed as ErrorEnvelope | null
    throw new ApiClientError(
      response.status,
      errPayload?.message || `Request failed (${response.status})`,
      errPayload?.details,
    )
  }

  return parsed.data
}

export const api = {
  health: async (): Promise<{ status: string }> => {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" })
    if (!res.ok) throw new Error("API unreachable")
    return res.json() as Promise<{ status: string }>
  },

  auth: {
    nonce: () =>
      apiRequest<string>("/api/auth/nonce", { method: "POST", auth: false }),
    verify: (input: { message: string; signature: string }) =>
      apiRequest<AuthVerifyResult>("/api/auth/verify", {
        method: "POST",
        auth: false,
        body: input,
      }),
    refresh: () => refreshAccessToken(),
    logout: async () => {
      try {
        await apiRequest<boolean>("/api/auth/logout", {
          method: "POST",
          auth: false,
          retryOn401: false,
        })
      } finally {
        setAccessToken(null)
      }
    },
  },

  analytics: {
    overview: () => apiRequest<AnalyticsOverview>("/api/analytics/overview"),
    tvl: () => apiRequest<{ totalValueUsd: string }>("/api/analytics/tvl"),
    volume: () => apiRequest<{ volumeUsd: string }>("/api/analytics/volume"),
    liquidity: () =>
      apiRequest<{ liquidityUsd: string }>("/api/analytics/liquidity"),
  },

  portfolio: {
    me: () => apiRequest<Portfolio>("/api/portfolio/me"),
  },

  tokens: {
    list: () => apiRequest<Token[]>("/api/tokens"),
    get: (address: string, chainId: number) =>
      apiRequest<Token>(
        `/api/tokens/${encodeURIComponent(address)}?chainId=${chainId}`,
      ),
    create: (input: {
      address: string
      chainId: number
      symbol: string
      name: string
      decimals: number
      isActive?: boolean
    }) =>
      apiRequest<Token>("/api/tokens", {
        method: "POST",
        body: input,
      }),
  },

  prices: {
    list: () => apiRequest<TokenPrice[]>("/api/prices"),
    get: (address: string, chainId: number) =>
      apiRequest<TokenPrice>(
        `/api/prices/${encodeURIComponent(address)}?chainId=${chainId}`,
      ),
    update: (
      address: string,
      chainId: number,
      priceUsd: string,
      workerKey?: string,
    ) =>
      apiRequest<TokenPrice>(
        `/api/prices/${encodeURIComponent(address)}?chainId=${chainId}`,
        {
          method: "PUT",
          body: { priceUsd },
          workerKey,
        },
      ),
  },

  pools: {
    list: () => apiRequest<Pool[]>("/api/pools"),
    get: (address: string, chainId: number) =>
      apiRequest<Pool>(
        `/api/pools/${encodeURIComponent(address)}?chainId=${chainId}`,
      ),
    create: (pool: {
      address: string
      chainId: number
      token0Address: string
      token1Address: string
      feeBps: number
      totalSupply?: string
      reserve0?: string
      reserve1?: string
      isActive?: boolean
    }) =>
      apiRequest<Pool>("/api/pools", {
        method: "POST",
        body: { pool },
      }),
    updateState: (
      address: string,
      chainId: number,
      body: {
        totalSupply: string
        reserve0: string
        reserve1: string
        isActive?: boolean
      },
      workerKey?: string,
    ) =>
      apiRequest<Pool>(
        `/api/pools/${encodeURIComponent(address)}?chainId=${chainId}`,
        {
          method: "PUT",
          body,
          workerKey,
        },
      ),
  },

  liquidity: {
    me: () => apiRequest<Liquidity[]>("/api/liquidity/me"),
    eventsMe: () => apiRequest<LiquidityEvent[]>("/api/liquidity/events/me"),
    eventByTx: (txHash: string, chainId: number) =>
      apiRequest<LiquidityEvent>(
        `/api/liquidity/events/${encodeURIComponent(txHash)}?chainId=${chainId}`,
      ),
  },

  swaps: {
    me: () => apiRequest<SwapData[]>("/api/swaps/me"),
    byTx: (txHash: string, chainId: number) =>
      apiRequest<SwapData>(
        `/api/swaps/${encodeURIComponent(txHash)}?chainId=${chainId}`,
      ),
  },

  staking: {
    farms: () => apiRequest<FarmData[]>("/api/staking"),
    farm: (address: string, chainId: number) =>
      apiRequest<FarmData>(
        `/api/staking/${encodeURIComponent(address)}?chainId=${chainId}`,
      ),
    createFarm: (farm: {
      address: string
      chainId: number
      poolAddress: string
      rewardTokenAddress: string
      isActive?: boolean
    }) =>
      apiRequest<FarmData>("/api/staking", {
        method: "POST",
        body: { farm },
      }),
    positionsMe: () => apiRequest<StakingPosition[]>("/api/staking/me"),
    eventsMe: () => apiRequest<StakingEvent[]>("/api/staking/events/me"),
    eventByTx: (txHash: string, chainId: number) =>
      apiRequest<StakingEvent>(
        `/api/staking/events/${encodeURIComponent(txHash)}?chainId=${chainId}`,
      ),
  },
}
