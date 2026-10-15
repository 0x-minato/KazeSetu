"use client"

import React, { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Compass, RefreshCw, Search, SlidersHorizontal } from "lucide-react"
import { api } from "@/lib/api"
import { SUPPORTED_CHAINS } from "@/lib/chains"
import { formatAmount, formatBps, formatUsd } from "@/lib/format"
import type { Pool } from "@/lib/types"
import {
  ChainBadge,
  CopyAddress,
  SectionHeader,
  TokenPairGlyph,
} from "@/components/ui/primitives"

export function PoolsView() {
  const [search, setSearch] = useState("")
  const [chainFilter, setChainFilter] = useState<number | "ALL">("ALL")
  const [selectedPoolKey, setSelectedPoolKey] = useState<string | null>(null)

  const poolsQuery = useQuery({
    queryKey: ["pools", "list"],
    queryFn: () => api.pools.list(),
  })

  const pricesQuery = useQuery({
    queryKey: ["prices", "list"],
    queryFn: () => api.prices.list(),
  })

  const priceMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of pricesQuery.data ?? []) {
      map.set(
        `${p.chainId}:${p.address.toLowerCase()}`,
        Number(p.priceUsd) || 0,
      )
    }
    return map
  }, [pricesQuery.data])

  const computedPools = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (poolsQuery.data ?? [])
      .filter((pool) => {
        if (chainFilter !== "ALL" && pool.chainId !== chainFilter) return false
        if (!q) return true
        return (
          pool.address.toLowerCase().includes(q) ||
          pool.token0.symbol.toLowerCase().includes(q) ||
          pool.token1.symbol.toLowerCase().includes(q) ||
          pool.token0.name.toLowerCase().includes(q) ||
          pool.token1.name.toLowerCase().includes(q)
        )
      })
      .map((pool) => {
        const p0 =
          priceMap.get(`${pool.chainId}:${pool.token0.address.toLowerCase()}`) ??
          0
        const p1 =
          priceMap.get(`${pool.chainId}:${pool.token1.address.toLowerCase()}`) ??
          0
        const r0 = Number(pool.reserve0) || 0
        const r1 = Number(pool.reserve1) || 0
        const usd0 = r0 * p0
        const usd1 = r1 * p1
        const tvlUsd = usd0 + usd1
        const spot0Per1 = r1 > 0 ? r0 / r1 : 0
        const spot1Per0 = r0 > 0 ? r1 / r0 : 0
        return {
          ...pool,
          p0,
          p1,
          usd0,
          usd1,
          tvlUsd,
          spot0Per1,
          spot1Per0,
        }
      })
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
  }, [poolsQuery.data, priceMap, search, chainFilter])

  const selectedPool = useMemo(() => {
    if (computedPools.length === 0) return null
    if (!selectedPoolKey) return computedPools[0]
    return (
      computedPools.find(
        (p) => `${p.chainId}:${p.address}` === selectedPoolKey,
      ) ?? computedPools[0]
    )
  }, [computedPools, selectedPoolKey])

  // Direct single-pool endpoint query for the selected pool
  const poolDetailQuery = useQuery<Pool>({
    queryKey: [
      "pools",
      "detail",
      selectedPool?.chainId,
      selectedPool?.address,
    ],
    queryFn: () =>
      api.pools.get(selectedPool!.address, selectedPool!.chainId),
    enabled: !!selectedPool,
  })

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="AMM Registry // Constant Product & Custom Fee Tiers"
        title="Liquidity Pools Explorer"
        subtitle="Inspect on-chain reserve depth, LP total supply, canonical token ordering, and implied spot ratios across all supported chains."
        right={
          <button
            type="button"
            onClick={() => {
              void poolsQuery.refetch()
              void pricesQuery.refetch()
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0C1017] px-3.5 py-2 font-mono-tabular text-xs text-slate-200 transition hover:border-teal-400/40 hover:text-teal-300"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                poolsQuery.isFetching ? "animate-spin text-teal-300" : ""
              }`}
            />
            Refresh Reserves
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0C1017] p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by token symbol, name, or pool contract address (0x…)"
            className="w-full rounded-lg border border-white/10 bg-[#07090E] py-2 pr-4 pl-10 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-400/50 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 font-mono-tabular text-xs text-slate-400">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Chain:
          </span>
          <button
            type="button"
            onClick={() => setChainFilter("ALL")}
            className={`rounded-md px-2.5 py-1.5 font-mono-tabular text-xs transition ${
              chainFilter === "ALL"
                ? "bg-teal-400 text-slate-950 font-semibold"
                : "border border-white/10 bg-[#07090E] text-slate-300 hover:border-white/20"
            }`}
          >
            ALL
          </button>
          {SUPPORTED_CHAINS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChainFilter(c.id)}
              className={`rounded-md px-2.5 py-1.5 font-mono-tabular text-xs transition ${
                chainFilter === c.id
                  ? "bg-teal-400 text-slate-950 font-semibold"
                  : "border border-white/10 bg-[#07090E] text-slate-300 hover:border-white/20"
              }`}
            >
              {c.short}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Table + Selected Pool Inspector */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-white/[0.08] bg-[#0C1017] lg:col-span-8">
          {computedPools.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Compass className="h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-300">
                No pools match your filter criteria
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try clearing the search query or switching chains.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                    <th className="px-6 py-3.5">Pool Pair</th>
                    <th className="px-4 py-3.5">Chain</th>
                    <th className="px-4 py-3.5 text-right">Fee Tier</th>
                    <th className="px-4 py-3.5 text-right">Reserve 0</th>
                    <th className="px-4 py-3.5 text-right">Reserve 1</th>
                    <th className="px-6 py-3.5 text-right">TVL (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {computedPools.map((pool) => {
                    const key = `${pool.chainId}:${pool.address}`
                    const isSelected =
                      selectedPool &&
                      `${selectedPool.chainId}:${selectedPool.address}` === key

                    return (
                      <tr
                        key={key}
                        onClick={() => setSelectedPoolKey(key)}
                        className={`cursor-pointer transition ${
                          isSelected
                            ? "bg-teal-400/[0.07]"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="px-6 py-4">
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
                        <td className="px-4 py-4">
                          <ChainBadge chainId={pool.chainId} />
                        </td>
                        <td className="px-4 py-4 text-right font-mono-tabular text-xs text-teal-300">
                          {formatBps(pool.feeBps)}{" "}
                          <span className="text-slate-500">
                            ({pool.feeBps} bps)
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-mono-tabular text-xs text-slate-200">
                          <div>
                            {formatAmount(pool.reserve0, 4)}{" "}
                            <span className="text-slate-400">
                              {pool.token0.symbol}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatUsd(pool.usd0)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right font-mono-tabular text-xs text-slate-200">
                          <div>
                            {formatAmount(pool.reserve1, 4)}{" "}
                            <span className="text-slate-400">
                              {pool.token1.symbol}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatUsd(pool.usd1)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono-tabular text-sm font-semibold text-slate-100">
                          {formatUsd(pool.tvlUsd)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pool Depth & Telemetry Inspector */}
        <div className="rounded-xl border border-white/[0.08] bg-[#0C1017] p-6 lg:col-span-4">
          {!selectedPool ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Select a pool row to inspect contract reserves and LP supply.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-white/[0.07] pb-4">
                <div className="flex items-center gap-3">
                  <TokenPairGlyph
                    symbol0={selectedPool.token0.symbol}
                    symbol1={selectedPool.token1.symbol}
                  />
                  <div>
                    <h3 className="font-display text-lg font-semibold text-slate-100">
                      {selectedPool.token0.symbol} /{" "}
                      {selectedPool.token1.symbol}
                    </h3>
                    <CopyAddress
                      address={selectedPool.address}
                      chainId={selectedPool.chainId}
                      chars={6}
                    />
                  </div>
                </div>
                <ChainBadge chainId={selectedPool.chainId} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/[0.06] bg-[#07090E] p-3.5">
                  <span className="font-mono-tabular text-[10px] tracking-wider text-slate-400 uppercase">
                    Pool TVL
                  </span>
                  <div className="font-mono-tabular mt-1 text-lg font-semibold text-slate-100">
                    {formatUsd(selectedPool.tvlUsd)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-[#07090E] p-3.5">
                  <span className="font-mono-tabular text-[10px] tracking-wider text-slate-400 uppercase">
                    LP Total Supply
                  </span>
                  <div className="font-mono-tabular mt-1 text-lg font-semibold text-teal-300">
                    {formatAmount(
                      poolDetailQuery.data?.totalSupply ??
                        selectedPool.totalSupply,
                      4,
                    )}
                  </div>
                </div>
              </div>

              {/* Implied Spot Exchange Rates */}
              <div className="rounded-lg border border-white/[0.06] bg-[#07090E] p-4 space-y-2.5">
                <div className="font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                  Implied Reserve Ratios
                </div>
                <div className="flex items-center justify-between font-mono-tabular text-xs">
                  <span className="text-slate-400">
                    1 {selectedPool.token0.symbol}
                  </span>
                  <span className="text-slate-200">
                    {selectedPool.spot1Per0 > 0
                      ? `${formatAmount(selectedPool.spot1Per0, 6)} ${selectedPool.token1.symbol}`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono-tabular text-xs">
                  <span className="text-slate-400">
                    1 {selectedPool.token1.symbol}
                  </span>
                  <span className="text-slate-200">
                    {selectedPool.spot0Per1 > 0
                      ? `${formatAmount(selectedPool.spot0Per1, 6)} ${selectedPool.token0.symbol}`
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Canonical Token Specs */}
              <div className="space-y-2.5">
                <div className="font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                  Canonical Constituents
                </div>
                {[
                  {
                    label: "Token 0",
                    token: selectedPool.token0,
                    reserve: selectedPool.reserve0,
                    price: selectedPool.p0,
                  },
                  {
                    label: "Token 1",
                    token: selectedPool.token1,
                    reserve: selectedPool.reserve1,
                    price: selectedPool.p1,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-white/[0.06] bg-[#07090E] p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular text-[11px] text-teal-300">
                        {item.label} · {item.token.symbol}
                      </span>
                      <span className="font-mono-tabular text-slate-400">
                        Oracle: {formatUsd(item.price)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <CopyAddress
                        address={item.token.address}
                        chainId={selectedPool.chainId}
                      />
                      <span className="font-mono-tabular text-slate-200">
                        {formatAmount(item.reserve, 4)} {item.token.symbol}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
