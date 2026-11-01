"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Flame,
  Gauge,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Sliders,
  Sparkles,
  Vault,
} from "lucide-react"
import { api } from "@/lib/api"
import { SUPPORTED_CHAINS } from "@/lib/chains"
import {
  formatAmount,
  formatTimestamp,
  formatUsd,
} from "@/lib/format"
import {
  approveErc20,
  compoundVaultFees,
  depositToVault,
  rebalanceVault,
  setVaultPause,
  withdrawFromVault,
} from "@/lib/onchain"
import type { VaultData, VaultPositionData } from "@/lib/types"
import { useAuth } from "@/context/auth-context"
import {
  ChainBadge,
  CopyAddress,
  SectionHeader,
  StatusPill,
  TokenPairGlyph,
  TxHashLink,
} from "@/components/ui/primitives"

type VaultActionTab = "deposit" | "withdraw" | "governor"

interface TxStatusState {
  status: "submitting" | "confirmed" | "error"
  title: string
  message: string
  txHash?: string
  chainId?: number
}

const formatFeeTier = (fee: number): string => {
  const pct = fee / 10_000
  return `${pct.toFixed(pct % 1 === 0 ? 0 : 2)}%`
}

export function VaultsView() {
  const { address } = useAuth()
  const queryClient = useQueryClient()

  const [chainFilter, setChainFilter] = useState<number | "ALL">("ALL")
  const [selectedVaultKey, setSelectedVaultKey] = useState<string | null>(null)
  const [actionTab, setActionTab] = useState<VaultActionTab>("deposit")

  // Deposit inputs
  const [depositAmount0, setDepositAmount0] = useState("")
  const [depositAmount1, setDepositAmount1] = useState("")
  const [depositMinShares, setDepositMinShares] = useState("0")

  // Withdraw inputs
  const [withdrawShares, setWithdrawShares] = useState("")

  // Rebalance inputs
  const [rebalanceTickLower, setRebalanceTickLower] = useState("-600")
  const [rebalanceTickUpper, setRebalanceTickUpper] = useState("600")
  const [rebalanceMinOut, setRebalanceMinOut] = useState("0")

  const [txStatus, setTxStatus] = useState<TxStatusState | null>(null)

  const vaultsQuery = useQuery({
    queryKey: ["vaults", "list"],
    queryFn: () => api.vaults.list(),
  })

  const myPositionsQuery = useQuery({
    queryKey: ["vaults", "me"],
    queryFn: () => api.vaults.positionsMe(),
  })

  const vaultEventsQuery = useQuery({
    queryKey: ["vaults", "events", "me"],
    queryFn: () => api.vaults.eventsMe(),
  })

  const positionByVaultKey = useMemo(() => {
    const map = new Map<string, VaultPositionData>()
    for (const pos of myPositionsQuery.data ?? []) {
      map.set(`${pos.chainId}:${pos.vault.address.toLowerCase()}`, pos)
    }
    return map
  }, [myPositionsQuery.data])

  const filteredVaults = useMemo(() => {
    return (vaultsQuery.data ?? [])
      .filter((v) => chainFilter === "ALL" || v.chainId === chainFilter)
      .sort((a, b) => (Number(b.tvlUsd) || 0) - (Number(a.tvlUsd) || 0))
  }, [vaultsQuery.data, chainFilter])

  const selectedVault: VaultData | null = useMemo(() => {
    if (filteredVaults.length === 0) return null
    if (!selectedVaultKey) return filteredVaults[0]
    return (
      filteredVaults.find(
        (v) =>
          `${v.chainId}:${v.address.toLowerCase()}` === selectedVaultKey,
      ) ?? filteredVaults[0]
    )
  }, [filteredVaults, selectedVaultKey])

  useEffect(() => {
    if (selectedVault) {
      setRebalanceTickLower(String(selectedVault.tickLower))
      setRebalanceTickUpper(String(selectedVault.tickUpper))
    }
  }, [selectedVault])

  const selectedUserPosition = useMemo(() => {
    if (!selectedVault) return null
    return (
      positionByVaultKey.get(
        `${selectedVault.chainId}:${selectedVault.address.toLowerCase()}`,
      ) ?? null
    )
  }, [selectedVault, positionByVaultKey])

  const refreshAll = async () => {
    await Promise.all([
      vaultsQuery.refetch(),
      myPositionsQuery.refetch(),
      vaultEventsQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ])
  }

  const runOnChainAction = async (
    title: string,
    chainId: number,
    fn: () => Promise<{ hash: string }>,
  ) => {
    setTxStatus({
      status: "submitting",
      title,
      message: "Awaiting EIP-1193 wallet signature and block confirmation...",
      chainId,
    })
    try {
      const res = await fn()
      setTxStatus({
        status: "confirmed",
        title: `${title} Confirmed`,
        message: "On-chain transaction mined. Synchronizing vault telemetry...",
        txHash: res.hash,
        chainId,
      })
      await refreshAll()
    } catch (err) {
      setTxStatus({
        status: "error",
        title: `${title} Failed`,
        message:
          err instanceof Error
            ? err.message
            : "Transaction rejected or reverted on chain.",
        chainId,
      })
    }
  }

  const computeTickProgress = (vault: VaultData): number => {
    const span = vault.tickUpper - vault.tickLower
    if (span <= 0) return 50
    const raw = ((vault.currentTick - vault.tickLower) / span) * 100
    return Math.max(4, Math.min(96, raw))
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Uniswap V3 Concentrated Liquidity // KazeClVault (clVault.sol)"
        title="Concentrated Liquidity Vaults"
        subtitle="Automated non-custodial Uniswap V3 range vaults with single-click fee compounding (handle_fees), optimal single-sided swap routing, and governor tick rebalancing."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0C1017] p-1">
              <button
                type="button"
                onClick={() => setChainFilter("ALL")}
                className={`cursor-pointer rounded px-2.5 py-1 font-mono-tabular text-xs transition ${
                  chainFilter === "ALL"
                    ? "bg-teal-400 font-semibold text-slate-950"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                ALL
              </button>
              {SUPPORTED_CHAINS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChainFilter(c.id)}
                  className={`cursor-pointer rounded px-2.5 py-1 font-mono-tabular text-xs transition ${
                    chainFilter === c.id
                      ? "bg-teal-400 font-semibold text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {c.short}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void refreshAll()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#0C1017] px-3.5 py-2 font-mono-tabular text-xs text-slate-200 transition hover:border-teal-400/40 hover:text-teal-300"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  vaultsQuery.isFetching ? "animate-spin text-teal-300" : ""
                }`}
              />
              Sync Vaults
            </button>
          </div>
        }
      />

      {/* Main Grid: Vault Cards + On-Chain Execution Panel */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left 7 cols: CL Vaults List */}
        <div className="space-y-4 lg:col-span-7">
          {filteredVaults.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-[#0C1017] px-6 py-16 text-center">
              <Vault className="h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-300">
                No Concentrated Liquidity Vaults Registered
              </p>
              <p className="mt-1 max-w-md text-xs text-slate-500">
                Register a deployed <code className="font-mono-tabular">KazeClVault</code>{" "}
                contract in the Ops Console to start indexing ticks, liquidity,
                and share positions.
              </p>
            </div>
          ) : (
            filteredVaults.map((vault) => {
              const key = `${vault.chainId}:${vault.address.toLowerCase()}`
              const isSelected =
                selectedVault &&
                `${selectedVault.chainId}:${selectedVault.address.toLowerCase()}` ===
                  key
              const userPos = positionByVaultKey.get(key)
              const tickProgress = computeTickProgress(vault)

              return (
                <div
                  key={key}
                  onClick={() => setSelectedVaultKey(key)}
                  className={`cursor-pointer rounded-xl border p-6 transition ${
                    isSelected
                      ? "border-teal-400/45 bg-[#0E141E] shadow-[0_0_28px_rgba(45,212,191,0.08)]"
                      : "border-white/[0.08] bg-[#0C1017] hover:border-white/20"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <TokenPairGlyph
                        symbol0={vault.pool.token0.symbol}
                        symbol1={vault.pool.token1.symbol}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-base font-semibold text-slate-100">
                            {vault.name}
                          </h3>
                          <span className="rounded border border-teal-400/30 bg-teal-400/10 px-1.5 py-0.5 font-mono-tabular text-[10px] font-semibold text-teal-300">
                            {vault.symbol}
                          </span>
                          <span className="rounded border border-indigo-400/30 bg-indigo-400/10 px-1.5 py-0.5 font-mono-tabular text-[10px] text-indigo-300">
                            {formatFeeTier(vault.fee)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                          <CopyAddress
                            address={vault.address}
                            chainId={vault.chainId}
                          />
                          <span className="font-mono-tabular text-[11px] text-slate-500">
                            NFT #{vault.tokenId}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <ChainBadge chainId={vault.chainId} />
                      <span
                        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono-tabular text-[10px] font-semibold tracking-wider uppercase ${
                          vault.inRange
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            vault.inRange ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                        />
                        {vault.inRange ? "IN RANGE" : "OUT OF RANGE"}
                      </span>
                      {vault.isPaused && (
                        <span className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono-tabular text-[10px] font-semibold text-rose-300 uppercase">
                          PAUSED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Tick Range Bar */}
                  <div className="mt-5 rounded-lg border border-white/[0.06] bg-[#07090E] p-3.5">
                    <div className="flex items-center justify-between font-mono-tabular text-[11px]">
                      <span className="text-slate-400">
                        LOWER TICK:{" "}
                        <span className="text-slate-200">{vault.tickLower}</span>
                      </span>
                      <span className="text-teal-300">
                        ACTIVE TICK: {vault.currentTick}
                      </span>
                      <span className="text-slate-400">
                        UPPER TICK:{" "}
                        <span className="text-slate-200">{vault.tickUpper}</span>
                      </span>
                    </div>
                    <div className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className={`h-full rounded-full ${
                          vault.inRange
                            ? "bg-gradient-to-r from-teal-500/50 via-emerald-400/70 to-teal-500/50"
                            : "bg-amber-500/40"
                        }`}
                        style={{ width: "100%" }}
                      />
                      <div
                        className="absolute top-0 h-full w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_8px_#fff]"
                        style={{ left: `${tickProgress}%` }}
                        title={`Current Tick: ${vault.currentTick}`}
                      />
                    </div>
                  </div>

                  {/* Vault Metrics Grid */}
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border border-white/[0.05] bg-[#07090E]/70 p-3">
                      <span className="font-mono-tabular text-[10px] text-slate-400 uppercase">
                        Vault TVL
                      </span>
                      <div className="font-mono-tabular mt-1 text-sm font-semibold text-slate-100">
                        {formatUsd(vault.tvlUsd)}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/[0.05] bg-[#07090E]/70 p-3">
                      <span className="font-mono-tabular text-[10px] text-slate-400 uppercase">
                        Active Liquidity (L)
                      </span>
                      <div className="font-mono-tabular mt-1 text-sm font-semibold text-teal-300">
                        {formatAmount(vault.liquidity, 2)}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/[0.05] bg-[#07090E]/70 p-3">
                      <span className="font-mono-tabular text-[10px] text-slate-400 uppercase">
                        Underlying Inventory
                      </span>
                      <div className="font-mono-tabular mt-1 text-xs text-slate-200">
                        {formatAmount(vault.amount0, 4)}{" "}
                        {vault.pool.token0.symbol}
                      </div>
                      <div className="font-mono-tabular text-xs text-slate-400">
                        {formatAmount(vault.amount1, 4)}{" "}
                        {vault.pool.token1.symbol}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/[0.05] bg-[#07090E]/70 p-3">
                      <span className="font-mono-tabular text-[10px] text-slate-400 uppercase">
                        Total Shares
                      </span>
                      <div className="font-mono-tabular mt-1 text-sm font-semibold text-slate-200">
                        {formatAmount(vault.totalSupply, 4)}
                      </div>
                    </div>
                  </div>

                  {/* User's Vault Position Footer */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3.5 font-mono-tabular text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Your Vault Shares:</span>
                      <span className="font-semibold text-teal-300">
                        {formatAmount(userPos?.shares ?? "0", 6)} {vault.symbol}
                      </span>
                      {userPos && Number(userPos.sharePct) > 0 && (
                        <span className="rounded bg-teal-400/15 px-1.5 py-0.5 text-[10px] text-teal-300">
                          {Number(userPos.sharePct).toFixed(2)}% of vault
                        </span>
                      )}
                    </div>
                    <div className="text-slate-300">
                      Position Value:{" "}
                      <span className="font-semibold text-slate-100">
                        {formatUsd(userPos?.valueUsd ?? "0")}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Right 5 cols: Interactive On-Chain Vault Action Panel */}
        <div className="lg:col-span-5">
          <div className="sticky top-20 rounded-xl border border-white/[0.08] bg-[#0C1017] p-6">
            {!selectedVault ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Select a Concentrated Liquidity Vault to execute on-chain actions.
              </div>
            ) : (
              <div className="space-y-5">
                {/* Selected Vault Header */}
                <div className="flex items-start justify-between border-b border-white/[0.07] pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular text-[10px] tracking-widest text-teal-300 uppercase">
                        On-Chain Execution // EIP-1193
                      </span>
                    </div>
                    <h3 className="font-display mt-1 text-lg font-semibold text-slate-100">
                      {selectedVault.name} ({selectedVault.symbol})
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      <CopyAddress
                        address={selectedVault.address}
                        chainId={selectedVault.chainId}
                        chars={6}
                      />
                    </div>
                  </div>
                  <ChainBadge chainId={selectedVault.chainId} />
                </div>

                {/* User Position Snapshot */}
                <div className="rounded-lg border border-white/[0.06] bg-[#07090E] p-3.5">
                  <div className="flex items-center justify-between font-mono-tabular text-[11px] text-slate-400">
                    <span>YOUR VAULT POSITION</span>
                    <span className="text-teal-300">
                      {formatUsd(selectedUserPosition?.valueUsd ?? "0")}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 font-mono-tabular text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500">Shares</div>
                      <div className="font-medium text-slate-100">
                        {formatAmount(selectedUserPosition?.shares ?? "0", 4)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">
                        {selectedVault.pool.token0.symbol}
                      </div>
                      <div className="font-medium text-slate-200">
                        {formatAmount(selectedUserPosition?.amount0 ?? "0", 4)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">
                        {selectedVault.pool.token1.symbol}
                      </div>
                      <div className="font-medium text-slate-200">
                        {formatAmount(selectedUserPosition?.amount1 ?? "0", 4)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Mode Selector Tabs */}
                <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-white/[0.07] bg-[#07090E] p-1">
                  {[
                    {
                      id: "deposit" as const,
                      label: "Deposit",
                      icon: ArrowDownToLine,
                    },
                    {
                      id: "withdraw" as const,
                      label: "Withdraw",
                      icon: ArrowUpFromLine,
                    },
                    {
                      id: "governor" as const,
                      label: "Fees & Range",
                      icon: Sliders,
                    },
                  ].map((tab) => {
                    const Icon = tab.icon
                    const active = actionTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActionTab(tab.id)}
                        className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md py-2 font-mono-tabular text-xs font-medium transition ${
                          active
                            ? "bg-teal-400/15 text-teal-200 border border-teal-400/30"
                            : "text-slate-400 hover:text-slate-200 border border-transparent"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    )
                  })}
                </div>

                {/* TAB 1: DEPOSIT */}
                {actionTab === "deposit" && (
                  <div className="space-y-3.5">
                    <div>
                      <div className="flex items-center justify-between font-mono-tabular text-[11px] text-slate-400">
                        <span>
                          Amount 0 ({selectedVault.pool.token0.symbol})
                        </span>
                        <span>
                          {selectedVault.pool.token0.decimals} decimals
                        </span>
                      </div>
                      <div className="mt-1 flex gap-2">
                        <input
                          type="text"
                          value={depositAmount0}
                          onChange={(e) => setDepositAmount0(e.target.value)}
                          placeholder="0.0"
                          className="flex-1 rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100 focus:border-teal-400/50 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void runOnChainAction(
                              `Approve ${selectedVault.pool.token0.symbol}`,
                              selectedVault.chainId,
                              () =>
                                approveErc20(
                                  selectedVault.pool.token0.address,
                                  selectedVault.address,
                                  depositAmount0 || "1000000",
                                  selectedVault.pool.token0.decimals,
                                ),
                            )
                          }
                          className="cursor-pointer rounded-lg border border-teal-400/30 bg-teal-400/10 px-3 py-2 font-mono-tabular text-xs font-medium text-teal-300 transition hover:bg-teal-400/20"
                        >
                          Approve {selectedVault.pool.token0.symbol}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between font-mono-tabular text-[11px] text-slate-400">
                        <span>
                          Amount 1 ({selectedVault.pool.token1.symbol})
                        </span>
                        <span>
                          {selectedVault.pool.token1.decimals} decimals
                        </span>
                      </div>
                      <div className="mt-1 flex gap-2">
                        <input
                          type="text"
                          value={depositAmount1}
                          onChange={(e) => setDepositAmount1(e.target.value)}
                          placeholder="0.0"
                          className="flex-1 rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100 focus:border-teal-400/50 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void runOnChainAction(
                              `Approve ${selectedVault.pool.token1.symbol}`,
                              selectedVault.chainId,
                              () =>
                                approveErc20(
                                  selectedVault.pool.token1.address,
                                  selectedVault.address,
                                  depositAmount1 || "1000000",
                                  selectedVault.pool.token1.decimals,
                                ),
                            )
                          }
                          className="cursor-pointer rounded-lg border border-indigo-400/30 bg-indigo-400/10 px-3 py-2 font-mono-tabular text-xs font-medium text-indigo-300 transition hover:bg-indigo-400/20"
                        >
                          Approve {selectedVault.pool.token1.symbol}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block font-mono-tabular text-[11px] text-slate-400">
                        Min Swap Output (amountOutMin Slippage Guard)
                      </label>
                      <input
                        type="text"
                        value={depositMinShares}
                        onChange={(e) => setDepositMinShares(e.target.value)}
                        placeholder="0"
                        className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100 focus:border-teal-400/50 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={selectedVault.isPaused}
                      onClick={() =>
                        void runOnChainAction(
                          "Vault Deposit",
                          selectedVault.chainId,
                          () =>
                            depositToVault({
                              vaultAddress: selectedVault.address,
                              amount0Raw: depositAmount0 || "0",
                              amount1Raw: depositAmount1 || "0",
                              decimals0: selectedVault.pool.token0.decimals,
                              decimals1: selectedVault.pool.token1.decimals,
                              amountOutMinRaw: depositMinShares || "0",
                              receiver: address ?? undefined,
                            }),
                        )
                      }
                      className="w-full cursor-pointer rounded-lg bg-teal-400 px-4 py-2.5 font-mono-tabular text-xs font-semibold text-slate-950 shadow-[0_0_20px_rgba(45,212,191,0.2)] transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Deposit & Mint Vault Shares
                    </button>
                  </div>
                )}

                {/* TAB 2: WITHDRAW */}
                {actionTab === "withdraw" && (
                  <div className="space-y-3.5">
                    <div>
                      <div className="flex items-center justify-between font-mono-tabular text-[11px] text-slate-400">
                        <span>Shares to Burn ({selectedVault.symbol})</span>
                        <button
                          type="button"
                          onClick={() =>
                            setWithdrawShares(
                              selectedUserPosition?.shares ?? "0",
                            )
                          }
                          className="cursor-pointer text-teal-300 hover:underline"
                        >
                          MAX:{" "}
                          {formatAmount(selectedUserPosition?.shares ?? "0", 6)}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={withdrawShares}
                        onChange={(e) => setWithdrawShares(e.target.value)}
                        placeholder="0.0"
                        className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100 focus:border-teal-400/50 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void runOnChainAction(
                          "Vault Withdraw",
                          selectedVault.chainId,
                          () =>
                            withdrawFromVault({
                              vaultAddress: selectedVault.address,
                              sharesRaw: withdrawShares,
                              receiver: address ?? undefined,
                            }),
                        )
                      }
                      className="w-full cursor-pointer rounded-lg bg-amber-400 px-4 py-2.5 font-mono-tabular text-xs font-semibold text-slate-950 transition hover:bg-amber-300"
                    >
                      Withdraw Shares & Claim Underlying
                    </button>
                  </div>
                )}

                {/* TAB 3: FEES & GOVERNOR */}
                {actionTab === "governor" && (
                  <div className="space-y-4">
                    {/* Auto-Compound Fees */}
                    <div className="rounded-lg border border-white/[0.06] bg-[#07090E] p-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono-tabular text-xs font-semibold text-emerald-300">
                            Auto-Compound Pool Fees
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Calls <code className="font-mono-tabular">vault.handle_fees()</code>{" "}
                            to collect Uniswap V3 accrued fees and reinvest into
                            active liquidity.
                          </p>
                        </div>
                        <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void runOnChainAction(
                            "Compound Vault Fees (handle_fees)",
                            selectedVault.chainId,
                            () =>
                              compoundVaultFees({
                                vaultAddress: selectedVault.address,
                              }),
                          )
                        }
                        className="mt-3 w-full cursor-pointer rounded-lg border border-emerald-400/30 bg-emerald-400/15 px-3 py-2 font-mono-tabular text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/25"
                      >
                        Compound Fees (handle_fees)
                      </button>
                    </div>

                    {/* Governor Rebalance */}
                    <div className="rounded-lg border border-white/[0.06] bg-[#07090E] p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tabular text-xs font-semibold text-indigo-300">
                          Governor Tick Rebalance (rebalance)
                        </span>
                        <Gauge className="h-4 w-4 text-indigo-400" />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-mono-tabular text-[10px] text-slate-400">
                            New Lower Tick (int24)
                          </label>
                          <input
                            type="number"
                            value={rebalanceTickLower}
                            onChange={(e) =>
                              setRebalanceTickLower(e.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0C1017] px-2.5 py-1.5 font-mono-tabular text-xs text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block font-mono-tabular text-[10px] text-slate-400">
                            New Upper Tick (int24)
                          </label>
                          <input
                            type="number"
                            value={rebalanceTickUpper}
                            onChange={(e) =>
                              setRebalanceTickUpper(e.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0C1017] px-2.5 py-1.5 font-mono-tabular text-xs text-slate-100"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-mono-tabular text-[10px] text-slate-400">
                          Min Swap Output (amount_out_min)
                        </label>
                        <input
                          type="text"
                          value={rebalanceMinOut}
                          onChange={(e) => setRebalanceMinOut(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-[#0C1017] px-2.5 py-1.5 font-mono-tabular text-xs text-slate-100"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void runOnChainAction(
                            "Rebalance Vault Range",
                            selectedVault.chainId,
                            () =>
                              rebalanceVault({
                                vaultAddress: selectedVault.address,
                                newTickLower: Number(rebalanceTickLower),
                                newTickUpper: Number(rebalanceTickUpper),
                                amountOutMinRaw: rebalanceMinOut,
                              }),
                          )
                        }
                        className="w-full cursor-pointer rounded-lg bg-indigo-500 px-3 py-2 font-mono-tabular text-xs font-semibold text-white transition hover:bg-indigo-400"
                      >
                        Rebalance Range [{rebalanceTickLower},{" "}
                        {rebalanceTickUpper}]
                      </button>
                    </div>

                    {/* Emergency Pause / Unpause */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          void runOnChainAction(
                            "Pause Vault",
                            selectedVault.chainId,
                            () =>
                              setVaultPause({
                                vaultAddress: selectedVault.address,
                                pause: true,
                              }),
                          )
                        }
                        className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono-tabular text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
                      >
                        <PauseCircle className="h-3.5 w-3.5" />
                        Pause Vault
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void runOnChainAction(
                            "Unpause Vault",
                            selectedVault.chainId,
                            () =>
                              setVaultPause({
                                vaultAddress: selectedVault.address,
                                pause: false,
                              }),
                          )
                        }
                        className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono-tabular text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Unpause Vault
                      </button>
                    </div>
                  </div>
                )}

                {/* Live Transaction Status Banner */}
                {txStatus && (
                  <div
                    className={`rounded-lg border p-3.5 text-xs ${
                      txStatus.status === "confirmed"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : txStatus.status === "submitting"
                          ? "border-teal-400/30 bg-teal-400/10 text-teal-200"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-mono-tabular font-semibold">
                        {txStatus.status === "confirmed" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : txStatus.status === "submitting" ? (
                          <Flame className="h-4 w-4 animate-pulse text-teal-300" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-rose-400" />
                        )}
                        {txStatus.title}
                      </span>
                      {txStatus.txHash && txStatus.chainId && (
                        <TxHashLink
                          txHash={txStatus.txHash}
                          chainId={txStatus.chainId}
                        />
                      )}
                    </div>
                    <p className="mt-1 text-[11px] opacity-90">
                      {txStatus.message}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vault Event Log Table */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0C1017]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-100">
              Vault Event Log
            </h2>
            <p className="text-xs text-slate-400">
              Indexed <code className="font-mono-tabular">DEPOSIT</code>,{" "}
              <code className="font-mono-tabular">WITHDRAW</code>,{" "}
              <code className="font-mono-tabular">REBALANCE</code>, and{" "}
              <code className="font-mono-tabular">HANDLE_FEES</code> events.
            </p>
          </div>
          <span className="font-mono-tabular text-xs text-slate-400">
            {vaultEventsQuery.data?.length ?? 0} events
          </span>
        </div>

        {(vaultEventsQuery.data ?? []).length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No Concentrated Liquidity Vault events indexed yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                  <th className="px-6 py-3">Event</th>
                  <th className="px-4 py-3">Vault</th>
                  <th className="px-4 py-3">Chain</th>
                  <th className="px-4 py-3 text-right">Amounts (0 / 1)</th>
                  <th className="px-4 py-3 text-right">Shares / Liquidity</th>
                  <th className="px-4 py-3">Tick Range</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tx Hash</th>
                  <th className="px-6 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {(vaultEventsQuery.data ?? []).map((ev, idx) => (
                  <tr
                    key={`${ev.txHash ?? idx}-${ev.createdAt}`}
                    className="transition hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 font-mono-tabular text-[11px] font-medium ${
                          ev.type === "DEPOSIT"
                            ? "border-teal-400/30 bg-teal-400/10 text-teal-300"
                            : ev.type === "WITHDRAW"
                              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                              : ev.type === "REBALANCE"
                                ? "border-indigo-400/30 bg-indigo-400/10 text-indigo-300"
                                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                        }`}
                      >
                        {ev.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-100">
                      {ev.vault.symbol}
                    </td>
                    <td className="px-4 py-3.5">
                      <ChainBadge chainId={ev.chainId} />
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular text-xs text-slate-200">
                      <div>
                        {formatAmount(ev.amount0, 4)}{" "}
                        {ev.vault.pool.token0.symbol}
                      </div>
                      <div className="text-slate-400">
                        {formatAmount(ev.amount1, 4)}{" "}
                        {ev.vault.pool.token1.symbol}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-tabular text-xs text-teal-300">
                      <div>{formatAmount(ev.shares, 4)} sh</div>
                      <div className="text-slate-500">
                        L: {formatAmount(ev.liquidity, 2)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono-tabular text-xs text-slate-300">
                      {ev.newTickLower !== null && ev.newTickUpper !== null
                        ? `[${ev.oldTickLower ?? "?"}..${ev.oldTickUpper ?? "?"}] → [${ev.newTickLower}..${ev.newTickUpper}]`
                        : `[${ev.vault.tickLower}..${ev.vault.tickUpper}]`}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusPill status={ev.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <TxHashLink txHash={ev.txHash} chainId={ev.chainId} />
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono-tabular text-xs text-slate-400">
                      {formatTimestamp(ev.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
