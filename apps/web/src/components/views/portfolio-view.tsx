"use client"

import React, { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  Layers,
  PieChart,
  RefreshCw,
  Sprout,
  Wallet,
} from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/context/auth-context"
import { formatAmount, formatBps, formatUsd } from "@/lib/format"
import {
  ChainBadge,
  CopyAddress,
  SectionHeader,
  TokenPairGlyph,
} from "@/components/ui/primitives"

export function PortfolioView() {
  const { address } = useAuth()

  const portfolioQuery = useQuery({
    queryKey: ["portfolio", "me"],
    queryFn: () => api.portfolio.me(),
  })

  const liquidityQuery = useQuery({
    queryKey: ["liquidity", "me"],
    queryFn: () => api.liquidity.me(),
  })

  const stakingQuery = useQuery({
    queryKey: ["staking", "me"],
    queryFn: () => api.staking.positionsMe(),
  })

  const lpMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const lp of liquidityQuery.data ?? []) {
      const key = `${lp.chainId}:${lp.pool.address.toLowerCase()}`
      map.set(key, (map.get(key) ?? 0) + (Number(lp.lpTokenAmount) || 0))
    }
    return map
  }, [liquidityQuery.data])

  const stakedMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const st of stakingQuery.data ?? []) {
      const key = `${st.chainId}:${st.farm.pool.address.toLowerCase()}`
      map.set(key, (map.get(key) ?? 0) + (Number(st.stakedAmount) || 0))
    }
    return map
  }, [stakingQuery.data])

  const totalUsd = Number(portfolioQuery.data?.totalValueUsd ?? 0)
  const positions = portfolioQuery.data?.positions ?? []

  const syncAll = () => {
    void portfolioQuery.refetch()
    void liquidityQuery.refetch()
    void stakingQuery.refetch()
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Wallet Valuation // Unified LP + Staked LP"
        title="Institutional Portfolio Statement"
        subtitle="Valued directly from on-chain reserves: (unstakedLP + stakedLP) / totalSupply × poolReserves. Staked LP in yield farms remains included in your net worth."
        right={
          <button
            type="button"
            onClick={syncAll}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0C1017] px-3.5 py-2 font-mono-tabular text-xs text-slate-200 transition hover:border-teal-400/40 hover:text-teal-300"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                portfolioQuery.isFetching ? "animate-spin text-teal-300" : ""
              }`}
            />
            Recompute Valuation
          </button>
        }
      />

      {portfolioQuery.isError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div>
            <p className="font-semibold">Portfolio Valuation Error</p>
            <p className="mt-0.5 text-xs text-rose-300/90">
              {portfolioQuery.error instanceof Error
                ? portfolioQuery.error.message
                : "Corrupted pool state (e.g. totalSupply === 0 with non-zero LP) or API error."}
            </p>
          </div>
        </div>
      )}

      {/* Net Worth Hero Banner */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0C1017] p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <span className="font-mono-tabular text-[11px] tracking-widest text-teal-300 uppercase">
              Net Liquidity Valuation (USD)
            </span>
            {address && <CopyAddress address={address} chars={6} />}
          </div>

          <div className="font-mono-tabular mt-4 text-4xl font-semibold tracking-tight text-slate-100 md:text-5xl">
            {portfolioQuery.isLoading ? "—" : formatUsd(totalUsd)}
          </div>

          {/* Allocation bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between font-mono-tabular text-[11px] text-slate-400">
              <span>Pool Allocation Breakdown</span>
              <span>{positions.length} active positions</span>
            </div>
            <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              {positions.length === 0 || totalUsd <= 0 ? (
                <div className="h-full w-full bg-white/[0.06]" />
              ) : (
                positions.map((pos, idx) => {
                  const share = Math.max(
                    2,
                    ((Number(pos.valueUsd) || 0) / totalUsd) * 100,
                  )
                  const colors = [
                    "bg-teal-400",
                    "bg-indigo-400",
                    "bg-emerald-400",
                    "bg-cyan-400",
                    "bg-amber-400",
                  ]
                  return (
                    <div
                      key={`${pos.pool.chainId}:${pos.pool.address}`}
                      style={{ width: `${share}%` }}
                      className={`${colors[idx % colors.length]} border-r border-[#07090E]`}
                      title={`${pos.pool.token0.symbol}/${pos.pool.token1.symbol}: ${formatUsd(pos.valueUsd)}`}
                    />
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5">
          <div className="rounded-xl border border-white/[0.08] bg-[#0C1017] p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                Unstaked LP Positions
              </span>
              <Layers className="h-4 w-4 text-teal-400" />
            </div>
            <div className="font-mono-tabular mt-3 text-2xl font-semibold text-slate-100">
              {liquidityQuery.data?.length ?? 0}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Direct AMM LP balances held in wallet across indexed pools.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#0C1017] p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                Staked Farm Positions
              </span>
              <Sprout className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="font-mono-tabular mt-3 text-2xl font-semibold text-slate-100">
              {stakingQuery.data?.length ?? 0}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              LP tokens staked in yield farms merged into pool valuation.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#0C1017] p-4 sm:col-span-2">
            <div className="flex items-center gap-2 font-mono-tabular text-[11px] text-slate-300">
              <PieChart className="h-3.5 w-3.5 text-indigo-400" />
              <span>Accounting Invariant:</span>
              <code className="text-teal-300">
                amount0 = (lp + stakedLp) / totalSupply × reserve0
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Positions Ledger */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0C1017]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-100">
              Consolidated Pool Positions
            </h2>
            <p className="text-xs text-slate-400">
              Pools with missing oracle quotes still render with $0.00 USD value
              so underlying token claims are never hidden.
            </p>
          </div>
          <span className="font-mono-tabular text-xs text-slate-400">
            {positions.length} rows
          </span>
        </div>

        {positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Wallet className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-medium text-slate-300">
              No LP or Staked LP positions found for this wallet
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              Once the blockchain indexer records an{" "}
              <code className="font-mono-tabular text-slate-400">ADD</code>{" "}
              liquidity event or{" "}
              <code className="font-mono-tabular text-slate-400">STAKE</code>{" "}
              event for your wallet address, your proportional token reserves
              will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                  <th className="px-6 py-3.5">Pool</th>
                  <th className="px-4 py-3.5">Chain</th>
                  <th className="px-4 py-3.5 text-right">Unstaked LP</th>
                  <th className="px-4 py-3.5 text-right">Staked LP</th>
                  <th className="px-4 py-3.5 text-right">Pool Share</th>
                  <th className="px-4 py-3.5 text-right">
                    Underlying Claim (Token0 / Token1)
                  </th>
                  <th className="px-6 py-3.5 text-right">USD Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {positions.map((pos) => {
                  const key = `${pos.pool.chainId}:${pos.pool.address.toLowerCase()}`
                  const unstaked = lpMap.get(key) ?? 0
                  const staked = stakedMap.get(key) ?? 0
                  const totalLp = unstaked + staked
                  const supply = Number(pos.pool.totalSupply) || 0
                  const sharePct = supply > 0 ? (totalLp / supply) * 100 : 0

                  return (
                    <tr
                      key={key}
                      className="transition hover:bg-white/[0.02]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <TokenPairGlyph
                            symbol0={pos.pool.token0.symbol}
                            symbol1={pos.pool.token1.symbol}
                          />
                          <div>
                            <div className="flex items-center gap-2 font-medium text-slate-100">
                              <span>
                                {pos.pool.token0.symbol} /{" "}
                                {pos.pool.token1.symbol}
                              </span>
                              <span className="rounded border border-teal-400/20 bg-teal-400/10 px-1.5 py-0.5 font-mono-tabular text-[10px] text-teal-300">
                                {formatBps(pos.pool.feeBps)}
                              </span>
                            </div>
                            <CopyAddress
                              address={pos.pool.address}
                              chainId={pos.pool.chainId}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <ChainBadge chainId={pos.pool.chainId} />
                      </td>
                      <td className="px-4 py-4 text-right font-mono-tabular text-xs text-slate-200">
                        {formatAmount(unstaked, 6)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono-tabular text-xs text-emerald-300">
                        {formatAmount(staked, 6)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono-tabular text-xs text-teal-300">
                        {sharePct.toFixed(4)}%
                      </td>
                      <td className="px-4 py-4 text-right font-mono-tabular text-xs text-slate-200">
                        <div>
                          {formatAmount(pos.amount0, 6)}{" "}
                          <span className="text-slate-400">
                            {pos.pool.token0.symbol}
                          </span>
                        </div>
                        <div className="mt-0.5">
                          {formatAmount(pos.amount1, 6)}{" "}
                          <span className="text-slate-400">
                            {pos.pool.token1.symbol}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono-tabular text-sm font-semibold text-slate-100">
                        {formatUsd(pos.valueUsd)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
