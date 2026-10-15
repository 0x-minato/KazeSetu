"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  API_BASE_URL,
  api,
  getAccessToken,
  hydrateStoredAccessToken,
  refreshAccessToken,
  setAccessToken,
  subscribeAccessToken,
} from "@/lib/api"
import {
  buildSiweMessage,
  decodeJwtIdentity,
  toChecksumAddress,
} from "@/lib/siwe"
import type { Role } from "@/lib/types"

export interface Eip1193Provider {
  isMetaMask?: boolean
  isRabby?: boolean
  isCoinbaseWallet?: boolean
  providers?: Eip1193Provider[]
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void
}

interface Eip6963AnnounceProviderEvent extends Event {
  detail?: {
    info?: { name?: string; rdns?: string }
    provider?: Eip1193Provider
  }
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

const utf8ToHex = (str: string): string => {
  const bytes = new TextEncoder().encode(str)
  let hex = "0x"
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0")
  }
  return hex
}

const resolveInjectedProvider = (
  discovered: Eip1193Provider | null,
): Eip1193Provider | null => {
  if (discovered) return discovered
  if (typeof window === "undefined") return null
  const eth = window.ethereum
  if (!eth) return null

  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    return (
      eth.providers.find((p) => p.isRabby || p.isMetaMask) ?? eth.providers[0]
    )
  }
  return eth
}

export type AuthStage =
  | "initializing"
  | "disconnected"
  | "signing"
  | "authenticated"

interface AuthContextValue {
  stage: AuthStage
  address: string | null
  chainId: number | null
  role: Role | null
  hasInjectedWallet: boolean
  error: string | null
  signInWithEthereum: () => Promise<void>
  switchChain: (targetChainId: number) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<AuthStage>("initializing")
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eip6963ProviderRef = useRef<Eip1193Provider | null>(null)

  const syncTokenState = useCallback((token: string | null) => {
    const decoded = decodeJwtIdentity(token)
    if (!decoded) {
      setAddress(null)
      setRole(null)
      setStage("disconnected")
      return
    }
    setAddress(decoded.address)
    setRole(decoded.role)
    setStage("authenticated")
  }, [])

  // Discover EIP-6963 & window.ethereum providers
  useEffect(() => {
    if (typeof window === "undefined") return

    const updateDetection = () => {
      const provider = resolveInjectedProvider(eip6963ProviderRef.current)
      setHasInjectedWallet(!!provider)
    }

    const onAnnounceProvider = (event: Event) => {
      const custom = event as Eip6963AnnounceProviderEvent
      const provider = custom.detail?.provider
      if (provider) {
        if (
          !eip6963ProviderRef.current ||
          custom.detail?.info?.rdns?.includes("metamask") ||
          custom.detail?.info?.rdns?.includes("rabby")
        ) {
          eip6963ProviderRef.current = provider
        }
        setHasInjectedWallet(true)
      }
    }

    window.addEventListener("eip6963:announceProvider", onAnnounceProvider)
    window.addEventListener("ethereum#initialized", updateDetection)
    window.dispatchEvent(new Event("eip6963:requestProvider"))
    updateDetection()

    // Late injection fallback check
    const timer = window.setTimeout(updateDetection, 500)

    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounceProvider)
      window.removeEventListener("ethereum#initialized", updateDetection)
      window.clearTimeout(timer)
    }
  }, [])

  // Hydrate existing session or refresh cookie on mount
  useEffect(() => {
    const unsub = subscribeAccessToken((token) => {
      syncTokenState(token)
    })

    const boot = async () => {
      const existing = hydrateStoredAccessToken()
      const decoded = decodeJwtIdentity(existing)
      const nowSec = Math.floor(Date.now() / 1000)

      if (decoded && (!decoded.exp || decoded.exp > nowSec + 15)) {
        syncTokenState(existing)
      } else {
        const refreshed = await refreshAccessToken()
        syncTokenState(refreshed)
      }

      const eth = resolveInjectedProvider(eip6963ProviderRef.current)
      if (eth) {
        try {
          const hexChain = (await eth.request({
            method: "eth_chainId",
          })) as string
          const parsedChain = parseInt(hexChain, 16)
          if (Number.isFinite(parsedChain)) {
            setChainId(parsedChain)
          }
        } catch {
          // ignore
        }
      }
    }

    void boot()
    return unsub
  }, [syncTokenState])

  // Subscribe to EIP-1193 account & chain changes
  useEffect(() => {
    const eth = resolveInjectedProvider(eip6963ProviderRef.current)
    if (!eth?.on) return

    const handleAccountsChanged = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? (accounts as string[]) : []
      const next = list[0]?.toLowerCase() ?? null
      const current = decodeJwtIdentity(getAccessToken())?.address ?? null
      if (!next || (current && next !== current)) {
        void api.auth.logout()
      }
    }

    const handleChainChanged = (hexChainId: unknown) => {
      if (typeof hexChainId === "string") {
        const nextChain = parseInt(hexChainId, 16)
        if (Number.isFinite(nextChain)) {
          setChainId(nextChain)
        }
      }
    }

    eth.on("accountsChanged", handleAccountsChanged)
    eth.on("chainChanged", handleChainChanged)

    return () => {
      eth.removeListener?.("accountsChanged", handleAccountsChanged)
      eth.removeListener?.("chainChanged", handleChainChanged)
    }
  }, [hasInjectedWallet])

  const signInWithEthereum = useCallback(async () => {
    setError(null)
    const eth = resolveInjectedProvider(eip6963ProviderRef.current)
    if (!eth) {
      setError(
        "No browser wallet detected. Make sure MetaMask, Rabby, or Coinbase Wallet is installed and unlocked for this site.",
      )
      return
    }

    setStage("signing")
    try {
      // 1. Request wallet accounts first (must happen close to user click gesture)
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[]
      const rawAddress = accounts?.[0]
      if (!rawAddress) {
        throw new Error("No wallet account returned by provider.")
      }
      const checksumAddress = toChecksumAddress(rawAddress)

      const hexChainId = (await eth.request({
        method: "eth_chainId",
      })) as string
      const activeChainId = parseInt(hexChainId, 16) || 1
      setChainId(activeChainId)

      // 2. Fetch single-use nonce from KazeSetu API
      let nonce: string
      try {
        nonce = await api.auth.nonce()
      } catch (err) {
        if (err instanceof TypeError) {
          throw new Error(
            `Cannot reach KazeSetu API at ${API_BASE_URL}. Make sure the backend is running ("cd apps/api && npm run dev") and SIWE_URI matches ${window.location.origin}.`,
          )
        }
        throw err
      }

      // 3. Build EIP-4361 SIWE message
      const message = buildSiweMessage({
        domain: window.location.host,
        address: checksumAddress,
        uri: window.location.origin,
        chainId: activeChainId,
        nonce,
      })

      // 4. Sign with EIP-191 personal_sign (hex-encoded UTF-8 for strict wallet compatibility)
      let signature: string
      try {
        signature = (await eth.request({
          method: "personal_sign",
          params: [utf8ToHex(message), checksumAddress],
        })) as string
      } catch {
        // Fallback for providers that expect raw string first
        signature = (await eth.request({
          method: "personal_sign",
          params: [message, checksumAddress],
        })) as string
      }

      // 5. Verify SIWE signature & establish session cookie + JWT
      const verified = await api.auth.verify({ message, signature })
      setChainId(verified.chainId)
      setAccessToken(verified.accessToken)
    } catch (err) {
      setStage(getAccessToken() ? "authenticated" : "disconnected")
      const msg =
        err instanceof Error ? err.message : "Failed to complete SIWE sign-in"
      setError(msg)
    }
  }, [])

  const switchChain = useCallback(async (targetChainId: number) => {
    const eth = resolveInjectedProvider(eip6963ProviderRef.current)
    if (!eth) return
    const hex = `0x${targetChainId.toString(16)}`
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hex }],
      })
      setChainId(targetChainId)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Wallet rejected chain switch",
      )
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    await api.auth.logout()
    setStage("disconnected")
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      stage,
      address,
      chainId,
      role,
      hasInjectedWallet,
      error,
      signInWithEthereum,
      switchChain,
      signOut,
      clearError,
    }),
    [
      stage,
      address,
      chainId,
      role,
      hasInjectedWallet,
      error,
      signInWithEthereum,
      switchChain,
      signOut,
      clearError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>")
  }
  return ctx
}
