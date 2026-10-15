"use client"

import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeftRight,
  Layers,
  RefreshCw,
  Search,
  Sprout,
} from "lucide-react"
import { api } from "@/lib/api"
import { SUPPORTED_CHAINS } from "@/lib/chains"
import { formatAmount, formatTimestamp } from "@/lib/format"
import type { LiquidityEvent, StakingEvent, SwapData } from "@/lib/types"
import {
  ChainBadge,
  SectionHeader,
  StatusPill,
  TxHashLink,
} from "@/components/ui/primitives"

type ActivityStream = "swaps" | "liquidity" | "staking"
type LookupKind = "swap" | "liquidity" | "staking"

export function ActivityView() {
  const [stream, setStream] = useState<ActivityStream>("swaps")
  const [lookupKind, setLookupKind] = useState<LookupKind>("swap")
  const [lookupChainId, setLookupChainId] = useState<number>(1)
  const [lookupTxHash, setLookupTxHash] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupResult, setLookupResult] = useState<
    | { kind: "swap"; data: SwapData }
    | { kind: "liquidity"; data: LiquidityEvent }
    | { kind: "staking"; data: StakingEvent }
    | null
  >(null)

  const swapsQuery = useQuery({
    queryKey: ["swaps", "me"],
    queryFn: () => api.swaps.me(),
  })

  const lpEventsQuery = useQuery({
    queryKey: ["liquidity", "events", "me"],
    queryFn: () => api.liquidity.eventsMe(),
  })

  const stakingEventsQuery = useQuery({
    queryKey: ["staking", "events", "me"],
    queryFn: () => api.staking.eventsMe(),
  })

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanHash = lookupTxHash.trim()
    if (!/^0x[a-fA-F0-9]{64}$/.test(cleanHash)) {
      setLookupError(
        "Transaction hash must be a 66-character 0x-prefixed hex string.",
      )
      setLookupResult(null)
      return
    }

    setLookupLoading(true)
    setLookupError(null)
    setLookupResult(null)
    try {
      if (lookupKind === "swap") {
        const data = await api.swaps.byTx(cleanHash, lookupChainId)
        setLookupResult({ kind: "swap", data })
      } else if (lookupKind === "liquidity") {
        const data = await api.liquidity.eventByTx(cleanHash, lookupChainId)
        setLookupResult({ kind: "liquidity", data })
      } else {
        const data = await api.staking.eventByTx(cleanHash, lookupChainId)
        setLookupResult({ kind: "staking", data })
      }
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : "Transaction not found on chain.",
      )
    } finally {
      setLookupLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Indexed Event Ledger // Swaps · Liquidity · Staking"
        title="On-Chain Activity & Tx Inspector"
        subtitle="Audit every indexed swap, LP addition/removal, and staking event for your wallet, or inspect any transaction hash by chain ID."
        right={
          <button
            type="button"
            onClick={() => {
              void swapsQuery.refetch()
              void lpEventsQuery.refetch()
              void stakingEventsQuery.refetch()
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0C1017] px-3.5 py-2 font-mono-tabular text-xs text-slate-200 transition hover:border-teal-400/40 hover:text-teal-300"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                swapsQuery.isFetching ||
                lpEventsQuery.isFetching ||
                stakingEventsQuery.isFetching
                  ? "animate-spin text-teal-300"
                  : ""
              }`}
            />
            Sync Ledger
          </button>
        }
      />

      {/* On-Demand Transaction Hash Inspector */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0C1017] p-6">
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-100">
              Deterministic TxHash Inspector
            </h2>
            <p className="text-xs text-slate-400">
              Queries{" "}
              <code className="font-mono-tabular text-slate-300">
                /api/swaps/:txHash
              </code>
              ,{" "}
              <code className="font-mono-tabular text-slate-300">
                /api/liquidity/events/:txHash
              </code>
              , or{" "}
              <code className="font-mono-tabular text-slate-300">
                /api/staking/events/:txHash
              </code>
            </p>
          </div>
        </div>

        <form
          onSubmit={handleLookup}
          className="mt-4 grid gap-3 md:grid-cols-12"
        >
          <div className="md:col-span-2">
            <select
              value={lookupKind}
              onChange={(e) => setLookupKind(e.target.value as LookupKind)}
              className="w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2.5 font-mono-tabular text-xs text-slate-200 focus:border-teal-400/50 focus:outline-none"
            >
              <option value="swap">Swap Event</option>
              <option value="liquidity">Liquidity Event</option>
              <option value="staking">Staking Event</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={lookupChainId}
              onChange={(e) => setLookupChainId(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2.5 font-mono-tabular text-xs text-slate-200 focus:border-teal-400/50 focus:outline-none"
            >
              {SUPPORTED_CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.short} ({c.id})
                </option>
              ))}
            </select>
          </div>

          <div className="relative md:col-span-6">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={lookupTxHash}
              onChange={(e) => setLookupTxHash(e.target.value)}
              placeholder="0x… (66-char transaction hash)"
              className="w-full rounded-lg border border-white/10 bg-[#07090E] py-2.5 pr-4 pl-10 font-mono-tabular text-xs text-slate-100 placeholder-slate-500 focus:border-teal-400/50 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={lookupLoading}
              className="w-full rounded-lg bg-teal-400 px-4 py-2.5 font-mono-tabular text-xs font-semibold text-slate-950 transition hover:bg-teal-300 disabled:opacity-60"
            >
              {lookupLoading ? "Querying…" : "Inspect Tx"}
            </button>
          </div>
        </form>

        {lookupError && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
            {lookupError}
          </div>
        )}

        {lookupResult && (
          <div className="mt-4 rounded-lg border border-teal-400/25 bg-[#07090E] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono-tabular text-xs font-semibold text-teal-300 uppercase">
                  {lookupResult.kind} Record Found
                </span>
                <ChainBadge chainId={lookupResult.data.chainId} />
                <StatusPill status={lookupResult.data.status} />
              </div>
              <TxHashLink
                txHash={lookupResult.data.txHash}
                chainId={lookupResult.data.chainId}
              />
            </div>

            {lookupResult.kind === "swap" && (
              <div className="mt-3 grid gap-3 font-mono-tabular text-xs sm:grid-cols-3">
                <div>
                  <span className="text-slate-500">Pool:</span>{" "}
                  <span className="text-slate-200">
                    {lookupResult.data.pool.token0.symbol}/
                    {lookupResult.data.pool.token1.symbol}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Amount In:</span>{" "}
                  <span className="text-slate-200">
                    {formatAmount(lookupResult.data.amountIn)}{" "}
                    {lookupResult.data.tokenIn.symbol}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Amount Out:</span>{" "}
                  <span className="text-emerald-300">
                    {formatAmount(lookupResult.data.amountOut)}{" "}
                    {lookupResult.data.tokenOut.symbol}
                  </span>
                </div>
              </div>
            )}

            {lookupResult.kind === "liquidity" && (
              <div className="mt-3 grid gap-3 font-mono-tabular text-xs sm:grid-cols-4">
                <div>
                  <span className="text-slate-500">Action:</span>{" "}
                  <span className="text-teal-300">
                    {lookupResult.data.type}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Token 0:</span>{" "}
                  <span className="text-slate-200">
                    {formatAmount(lookupResult.data.amount0)}{" "}
                    {lookupResult.data.pool.token0.symbol}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Token 1:</span>{" "}
                  <span className="text-slate-200">
                    {formatAmount(lookupResult.data.amount1)}{" "}
                    {lookupResult.data.pool.token1.symbol}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">LP Delta:</span>{" "}
                  <span className="text-slate-200">
                    {formatAmount(lookupResult.data.lpAmount)} LP
                  </span>
                </div>
              </div>
            )}

            {lookupResult.kind === "staking" && (
              <div className="mt-3 grid gap-3 font-mono-tabular text-xs sm:grid-cols-3">
                <div>
                  <span className="text-slate-500">Action:</span>{" "}
                  <span className="text-teal-300">
                    {lookupResult.data.type}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Farm:</span>{" "}
                  <span className="text-slate-200">
                    {lookupResult.data.farm.pool.token0.symbol}/
                    {lookupResult.data.farm.pool.token1.symbol}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Amount:</span>{" "}
                  <span className="text-emerald-300">
                    {formatAmount(lookupResult.data.amount)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stream Selector Tabs */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0C1017]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-6 py-4">
          <div className="flex items-center gap-2">
            {[
              {
                id: "swaps" as const,
                label: "Swaps",
                count: swapsQuery.data?.length ?? 0,
                icon: ArrowLeftRight,
              },
              {
                id: "liquidity" as const,
                label: "LP Events",
                count: lpEventsQuery.data?.length ?? 0,
                icon: Layers,
              },
              {
                id: "staking" as const,
                label: "Staking Events",
                count: stakingEventsQuery.data?.length ?? 0,
                icon: Sprout,
              },
            ].map((tab) => {
              const Icon = tab.icon
              const active = stream === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStream(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 font-mono-tabular text-xs transition ${
                    active
                      ? "bg-teal-400/15 text-teal-300 border border-teal-400/30"
                      : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px]">
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Swaps Table */}
        {stream === "swaps" && (
          <div className="overflow-x-auto">
            {(swapsQuery.data ?? []).length === 0 ? (
              <div className="px-6 py-14 text-center text-sm text-slate-500">
                No indexed swaps for your wallet yet.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                    <th className="px-6 py-3">Pool</th>
                    <th className="px-4 py-3">Chain</th>
                    <th className="px-4 py-3 text-right">Token In</th>
                    <th className="px-4 py-3 text-right">Token Out</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Tx Hash</th>
                    <th className="px-6 py-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {(swapsQuery.data ?? []).map((swap, i) => (
                    <tr
                      key={`${swap.txHash ?? i}-${swap.createdAt}`}
                      className="transition hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-3.5 font-medium text-slate-100">
                        {swap.pool.token0.symbol} / {swap.pool.token1.symbol}
                      </td>
                      <td className="px-4 py-3.5">
                        <ChainBadge chainId={swap.chainId} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-tabular text-xs text-slate-300">
                        -{formatAmount(swap.amountIn, 6)} {swap.tokenIn.symbol}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-tabular text-xs text-emerald-300">
                        +{formatAmount(swap.amountOut, 6)}{" "}
                        {swap.tokenOut.symbol}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill status={swap.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <TxHashLink
                          txHash={swap.txHash}
                          chainId={swap.chainId}
                        />
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono-tabular text-xs text-slate-400">
                        {formatTimestamp(swap.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Liquidity Events Table */}
        {stream === "liquidity" && (
          <div className="overflow-x-auto">
            {(lpEventsQuery.data ?? []).length === 0 ? (
              <div className="px-6 py-14 text-center text-sm text-slate-500">
                No indexed liquidity events for your wallet yet.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                    <th className="px-6 py-3">Type</th>
                    <th className="px-4 py-3">Pool</th>
                    <th className="px-4 py-3">Chain</th>
                    <th className="px-4 py-3 text-right">Amounts</th>
                    <th className="px-4 py-3 text-right">LP Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Tx Hash</th>
                    <th className="px-6 py-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {(lpEventsQuery.data ?? []).map((ev, i) => (
                    <tr
                      key={`${ev.txHash ?? i}-${ev.createdAt}`}
                      className="transition hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 font-mono-tabular text-[11px] font-medium ${
                            ev.type === "ADD"
                              ? "border-teal-400/30 bg-teal-400/10 text-teal-300"
                              : "border-rose-400/30 bg-rose-400/10 text-rose-300"
                          }`}
                        >
                          {ev.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-100">
                        {ev.pool.token0.symbol} / {ev.pool.token1.symbol}
                      </td>
                      <td className="px-4 py-3.5">
                        <ChainBadge chainId={ev.chainId} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-tabular text-xs text-slate-200">
                        <div>
                          {formatAmount(ev.amount0, 4)} {ev.pool.token0.symbol}
                        </div>
                        <div className="text-slate-400">
                          {formatAmount(ev.amount1, 4)} {ev.pool.token1.symbol}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-tabular text-xs text-teal-300">
                        {formatAmount(ev.lpAmount, 6)} LP
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
            )}
          </div>
        )}

        {/* Staking Events Table */}
        {stream === "staking" && (
          <div className="overflow-x-auto">
            {(stakingEventsQuery.data ?? []).length === 0 ? (
              <div className="px-6 py-14 text-center text-sm text-slate-500">
                No indexed staking events for your wallet yet.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                    <th className="px-6 py-3">Type</th>
                    <th className="px-4 py-3">Farm</th>
                    <th className="px-4 py-3">Chain</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Tx Hash</th>
                    <th className="px-6 py-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {(stakingEventsQuery.data ?? []).map((ev, i) => (
                    <tr
                      key={`${ev.txHash ?? i}-${ev.createdAt}`}
                      className="transition hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-3.5">
                        <span className="inline-flex rounded border border-teal-400/30 bg-teal-400/10 px-2 py-0.5 font-mono-tabular text-[11px] font-medium text-teal-300">
                          {ev.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-100">
                        {ev.farm.pool.token0.symbol} /{" "}
                        {ev.farm.pool.token1.symbol}
                      </td>
                      <td className="px-4 py-3.5">
                        <ChainBadge chainId={ev.chainId} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-tabular text-xs text-slate-200">
                        {formatAmount(ev.amount, 6)}
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
            )}
          </div>
        )}
      </div>
    </div>
  )
}
