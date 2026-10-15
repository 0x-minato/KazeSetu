"use client"

import React, { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Activity,
  ArrowUpRight,
  Coins,
  Layers,
  RefreshCw,
  Sprout,
  TrendingUp,
} from "lucide-react"
import { api } from "@/lib/api"
import {
  formatAmount,
  formatBps,
  formatTimestamp,
  formatUsd,
} from "@/lib/format"
import {
  ChainBadge,
  CopyAddress,
  SectionHeader,
  StatusPill,
  TokenPairGlyph,
} from "@/components/ui/primitives"

export function OverviewView({
  onNavigate,
}: {
  onNavigate: (tab: "portfolio" | "pools" | "staking" | "activity") => void
}) {
  const overviewQuery = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: () => api.analytics.overview(),
  })

  const pricesQuery = useQuery({
    queryKey: ["prices", "list"],
    queryFn: () => api.prices.list(),
  })

  const tokensQuery = useQuery({
    queryKey: ["tokens", "list"],
    queryFn: () => api.tokens.list(),
  })

  const poolsQuery = useQuery({
    queryKey: ["pools", "list"],
    queryFn: () => api.pools.list(),
  })

  const farmsQuery = useQuery({
    queryKey: ["staking", "farms"],
    queryFn: () => api.staking.farms(),
  })

  const priceMap = useMemo(() => {
    const map = new Map<string, { priceUsd: number; updatedAt: string }>()
    for (const p of pricesQuery.data ?? []) {
      map.set(`${p.chainId}:${p.address.toLowerCase()}`, {
        priceUsd: Number(p.priceUsd) || 0,
        updatedAt: p.updatedAt,
      })
    }
    return map
  }, [pricesQuery.data])

  const enrichedPools = useMemo(() => {
    return (poolsQuery.data ?? [])
      .map((pool) => {
        const p0 =
          priceMap.get(`${pool.chainId}:${pool.token0.address.toLowerCase()}`)
            ?.priceUsd ?? 0
        const p1 =
          priceMap.get(`${pool.chainId}:${pool.token1.address.toLowerCase()}`)
            ?.priceUsd ?? 0
        const tvlUsd =
          (Number(pool.reserve0) || 0) * p0 + (Number(pool.reserve1) || 0) * p1
        return { ...pool, tvlUsd }
      })
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
  }, [poolsQuery.data, priceMap])

  const isRefreshing =
    overviewQuery.isFetching ||
    pricesQuery.isFetching ||
    poolsQuery.isFetching ||
    tokensQuery.isFetching

  const handleRefreshAll = () => {
    void overviewQuery.refetch()
    void pricesQuery.refetch()
    void tokensQuery.refetch()
    void poolsQuery.refetch()
    void farmsQuery.refetch()
  }

  const netLiquidityNum = Number(overviewQuery.data?.liquidity ?? 0)

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Protocol Telemetry // 24H Rolling Projection"
        title="Market & Liquidity Overview"
        subtitle="Real-time protocol TVL, 24h swap volume, net liquidity flow (ADD − REMOVE), and oracle token prices projected from chain state."
        right={
          <button
            type="button"
            onClick={handleRefreshAll}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0C1017] px-3.5 py-2 font-mono-tabular text-xs text-slate-200 transition hover:border-teal-400/40 hover:text-teal-300"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-teal-300" : ""}`}
            />
            Sync Projection
          </button>
        }
      />

      {/* Top 3 Primary KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0C1017] p-6 transition hover:border-teal-400/30">
          <div className="flex items-center justify-between">
            <span className="font-mono-tabular text-[11px] tracking-widest text-slate-400 uppercase">
              Total Value Locked (TVL)
            </span>
            <Layers className="h-4 w-4 text-teal-400" />
          </div>
          <div className="font-mono-tabular mt-3 text-3xl font-semibold tracking-tight text-slate-100">
            {overviewQuery.isLoading
              ? "—"
              : formatUsd(overviewQuery.data?.tvl ?? "0")}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-slate-400">
            <span>Active AMM Pools</span>
            <span className="font-mono-tabular text-slate-200">
              {poolsQuery.data?.length ?? 0} pools
            </span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0C1017] p-6 transition hover:border-indigo-400/30">
          <div className="flex items-center justify-between">
            <span className="font-mono-tabular text-[11px] tracking-widest text-slate-400 uppercase">
              24H Swap Volume
            </span>
            <TrendingUp className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="font-mono-tabular mt-3 text-3xl font-semibold tracking-tight text-slate-100">
            {overviewQuery.isLoading
              ? "—"
              : formatUsd(overviewQuery.data?.volume ?? "0")}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-slate-400">
            <span>Settled Swaps Window</span>
            <span className="font-mono-tabular text-slate-200">
              Rolling 24h USD
            </span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0C1017] p-6 transition hover:border-emerald-400/30">
          <div className="flex items-center justify-between">
            <span className="font-mono-tabular text-[11px] tracking-widest text-slate-400 uppercase">
              24H Net Liquidity Flow
            </span>
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <div
            className={`font-mono-tabular mt-3 text-3xl font-semibold tracking-tight ${
              netLiquidityNum < 0 ? "text-rose-400" : "text-emerald-300"
            }`}
          >
            {overviewQuery.isLoading
              ? "—"
              : `${netLiquidityNum > 0 ? "+" : ""}${formatUsd(overviewQuery.data?.liquidity ?? "0")}`}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-slate-400">
            <span>Formula</span>
            <span className="font-mono-tabular text-slate-300">
              Σ(ADD) − Σ(REMOVE)
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Split: Top Liquidity Pools + Oracle Price Matrix */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left 7 cols: Top Pools by TVL */}
        <div className="rounded-xl border border-white/[0.08] bg-[#0C1017] lg:col-span-7">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-100">
                Canonical Liquidity Pools
              </h2>
              <p className="text-xs text-slate-400">
                Sorted by live reserve valuation · Canonical{" "}
                <code className="font-mono-tabular text-slate-300">
                  token0 &lt; token1
                </code>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("pools")}
              className="inline-flex items-center gap-1 font-mono-tabular text-xs text-teal-300 transition hover:text-teal-200"
            >
              Explore All
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {enrichedPools.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No active liquidity pools indexed yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                    <th className="px-6 py-3">Pair</th>
                    <th className="px-4 py-3">Chain</th>
                    <th className="px-4 py-3 text-right">Fee</th>
                    <th className="px-4 py-3 text-right">Reserves</th>
                    <th className="px-6 py-3 text-right">Pool TVL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {enrichedPools.slice(0, 6).map((pool) => (
                    <tr
                      key={`${pool.chainId}:${pool.address}`}
                      className="transition hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <TokenPairGlyph
                            symbol0={pool.token0.symbol}
                            symbol1={pool.token1.symbol}
                          />
                          <div>
                            <div className="font-medium text-slate-100">
                              {pool.token0.symbol} / {pool.token1.symbol}
                            </div>
                            <CopyAddress
                              address={pool.address}
                              chainId={pool.chainId}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <ChainBadge chainId={pool.chainId} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-tabular text-xs text-teal-300">
                        {formatBps(pool.feeBps)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono-tabular text-xs text-slate-300">
                        <div>
                          {formatAmount(pool.reserve0, 3)} {pool.token0.symbol}
                        </div>
                        <div className="text-slate-500">
                          {formatAmount(pool.reserve1, 3)} {pool.token1.symbol}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono-tabular font-medium text-slate-100">
                        {formatUsd(pool.tvlUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 5 cols: Token Price Oracle & Allowlist */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="rounded-xl border border-white/[0.08] bg-[#0C1017]">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-teal-400" />
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-100">
                    Oracle Price Matrix
                  </h2>
                  <p className="text-xs text-slate-400">
                    Allowlisted tokens & cached USD feed
                  </p>
                </div>
              </div>
              <span className="font-mono-tabular text-xs text-slate-400">
                {tokensQuery.data?.length ?? 0} tokens
              </span>
            </div>

            {(tokensQuery.data ?? []).length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                No allowlisted tokens found.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {(tokensQuery.data ?? []).map((token) => {
                  const priceEntry = priceMap.get(
                    `${token.chainId}:${token.address.toLowerCase()}`,
                  )
                  return (
                    <div
                      key={`${token.chainId}:${token.address}`}
                      className="flex items-center justify-between px-6 py-3.5 transition hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#111722] font-mono-tabular text-xs font-semibold text-teal-300">
                          {token.symbol.slice(0, 4)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-100">
                              {token.symbol}
                            </span>
                            <span className="text-xs text-slate-500">
                              {token.name}
                            </span>
                            <ChainBadge chainId={token.chainId} />
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <CopyAddress
                              address={token.address}
                              chainId={token.chainId}
                            />
                            <span className="font-mono-tabular text-[11px] text-slate-500">
                              · {token.decimals} dec
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono-tabular text-sm font-semibold text-slate-100">
                          {priceEntry ? formatUsd(priceEntry.priceUsd) : "$0.00"}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-slate-500">
                          {priceEntry
                            ? formatTimestamp(priceEntry.updatedAt)
                            : "No oracle quote"}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Active Yield Farms Summary Card */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0C1017] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sprout className="h-4 w-4 text-emerald-400" />
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  Active Yield Farms
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("staking")}
                className="inline-flex items-center gap-1 font-mono-tabular text-xs text-teal-300 hover:text-teal-200"
              >
                Open Staking
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {(farmsQuery.data ?? []).length === 0 ? (
                <p className="text-xs text-slate-500">
                  No staking farms registered on protocol yet.
                </p>
              ) : (
                (farmsQuery.data ?? []).slice(0, 4).map((farm) => (
                  <div
                    key={`${farm.chainId}:${farm.address}`}
                    className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#07090E]/70 px-3.5 py-2.5"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-200">
                        {farm.pool.token0.symbol}/{farm.pool.token1.symbol} LP →{" "}
                        <span className="text-emerald-300">
                          Earn {farm.rewardToken.symbol}
                        </span>
                      </div>
                      <CopyAddress
                        address={farm.address}
                        chainId={farm.chainId}
                      />
                    </div>
                    <StatusPill status={farm.isActive ? "ACTIVE" : "PAUSED"} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
