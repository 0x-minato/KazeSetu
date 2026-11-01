"use client"

import React, { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Flame,
  RefreshCw,
  Sprout,
} from "lucide-react"
import { api } from "@/lib/api"
import {
  formatAmount,
  formatBps,
  formatTimestamp,
  formatUsd,
} from "@/lib/format"
import {
  approveErc20,
  claimFarmRewards,
  stakeInFarm,
  unstakeFromFarm,
} from "@/lib/onchain"
import {
  ChainBadge,
  CopyAddress,
  SectionHeader,
  StatusPill,
  TokenPairGlyph,
  TxHashLink,
} from "@/components/ui/primitives"

interface FarmTxFeedback {
  farmKey: string
  status: "submitting" | "confirmed" | "error"
  message: string
  txHash?: string
  chainId: number
}

export function StakingView() {
  const queryClient = useQueryClient()
  const [amountByFarm, setAmountByFarm] = useState<Record<string, string>>({})
  const [txFeedback, setTxFeedback] = useState<FarmTxFeedback | null>(null)

  const farmsQuery = useQuery({
    queryKey: ["staking", "farms"],
    queryFn: () => api.staking.farms(),
  })

  const myStakingQuery = useQuery({
    queryKey: ["staking", "me"],
    queryFn: () => api.staking.positionsMe(),
  })

  const stakingEventsQuery = useQuery({
    queryKey: ["staking", "events", "me"],
    queryFn: () => api.staking.eventsMe(),
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

  const myStakeByFarm = useMemo(() => {
    const map = new Map<string, string>()
    for (const pos of myStakingQuery.data ?? []) {
      map.set(
        `${pos.chainId}:${pos.farm.address.toLowerCase()}`,
        pos.stakedAmount,
      )
    }
    return map
  }, [myStakingQuery.data])

  const refreshAll = async () => {
    await Promise.all([
      farmsQuery.refetch(),
      myStakingQuery.refetch(),
      stakingEventsQuery.refetch(),
      pricesQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ])
  }

  const executeFarmTx = async (
    farmKey: string,
    chainId: number,
    label: string,
    fn: () => Promise<{ hash: string }>,
  ) => {
    setTxFeedback({
      farmKey,
      chainId,
      status: "submitting",
      message: `${label}: awaiting wallet confirmation...`,
    })
    try {
      const res = await fn()
      setTxFeedback({
        farmKey,
        chainId,
        status: "confirmed",
        message: `${label} confirmed on-chain.`,
        txHash: res.hash,
      })
      await refreshAll()
    } catch (err) {
      setTxFeedback({
        farmKey,
        chainId,
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : `${label} failed or was rejected.`,
      })
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Yield Gauges // LP Staking & Reward Distribution"
        title="Staking Farms & Positions"
        subtitle="LP tokens staked in KazeSetu farms earn reward tokens while remaining merged into your portfolio's underlying reserve valuation."
        right={
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#0C1017] px-3.5 py-2 font-mono-tabular text-xs text-slate-200 transition hover:border-teal-400/40 hover:text-teal-300"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                farmsQuery.isFetching ? "animate-spin text-teal-300" : ""
              }`}
            />
            Sync Farms
          </button>
        }
      />

      {/* Active Farms Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(farmsQuery.data ?? []).length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-[#0C1017] px-6 py-16 text-center">
            <Sprout className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-medium text-slate-300">
              No Staking Farms Registered
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              Protocol administrators can deploy and register LP staking farms
              from the Admin Console.
            </p>
          </div>
        ) : (
          (farmsQuery.data ?? []).map((farm) => {
            const key = `${farm.chainId}:${farm.address.toLowerCase()}`
            const userStaked = myStakeByFarm.get(key) ?? "0"
            const inputAmount = amountByFarm[key] ?? ""
            const p0 =
              priceMap.get(
                `${farm.chainId}:${farm.pool.token0.address.toLowerCase()}`,
              ) ?? 0
            const p1 =
              priceMap.get(
                `${farm.chainId}:${farm.pool.token1.address.toLowerCase()}`,
              ) ?? 0
            const rewardPrice =
              priceMap.get(
                `${farm.chainId}:${farm.rewardToken.address.toLowerCase()}`,
              ) ?? 0
            const poolTvl =
              (Number(farm.pool.reserve0) || 0) * p0 +
              (Number(farm.pool.reserve1) || 0) * p1
            const feedback =
              txFeedback?.farmKey === key ? txFeedback : null

            return (
              <div
                key={key}
                className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#0C1017] p-6 transition hover:border-teal-400/30"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <TokenPairGlyph
                        symbol0={farm.pool.token0.symbol}
                        symbol1={farm.pool.token1.symbol}
                      />
                      <div>
                        <h3 className="font-display text-base font-semibold text-slate-100">
                          {farm.pool.token0.symbol} / {farm.pool.token1.symbol}
                        </h3>
                        <CopyAddress
                          address={farm.address}
                          chainId={farm.chainId}
                        />
                      </div>
                    </div>
                    <StatusPill status={farm.isActive ? "ACTIVE" : "PAUSED"} />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2.5 rounded-lg border border-white/[0.06] bg-[#07090E] p-3.5">
                    <div>
                      <span className="font-mono-tabular text-[10px] tracking-wider text-slate-400 uppercase">
                        Reward Asset
                      </span>
                      <div className="mt-1 flex items-center gap-1.5 font-mono-tabular text-sm font-semibold text-emerald-300">
                        <Award className="h-3.5 w-3.5" />
                        {farm.rewardToken.symbol}
                      </div>
                      <div className="font-mono-tabular text-[11px] text-slate-500">
                        {formatUsd(rewardPrice)} / token
                      </div>
                    </div>
                    <div>
                      <span className="font-mono-tabular text-[10px] tracking-wider text-slate-400 uppercase">
                        Underlying Pool TVL
                      </span>
                      <div className="font-mono-tabular mt-1 text-sm font-semibold text-slate-100">
                        {formatUsd(poolTvl)}
                      </div>
                      <div className="font-mono-tabular text-[11px] text-slate-500">
                        Fee: {formatBps(farm.pool.feeBps)}
                      </div>
                    </div>
                  </div>

                  {/* Interactive On-Chain Staking Action Panel */}
                  <div className="mt-4 space-y-2.5 rounded-lg border border-white/[0.06] bg-[#07090E] p-3.5">
                    <div className="flex items-center justify-between font-mono-tabular text-[11px] text-slate-400">
                      <span>LP Amount (18 dec)</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAmountByFarm((prev) => ({
                            ...prev,
                            [key]: userStaked,
                          }))
                        }
                        className="cursor-pointer text-teal-300 hover:underline"
                      >
                        Staked: {formatAmount(userStaked, 4)} LP
                      </button>
                    </div>

                    <input
                      type="text"
                      value={inputAmount}
                      onChange={(e) =>
                        setAmountByFarm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      placeholder="0.0"
                      className="w-full rounded-lg border border-white/10 bg-[#0C1017] px-3 py-1.5 font-mono-tabular text-xs text-slate-100 placeholder-slate-500 focus:border-teal-400/50 focus:outline-none"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void executeFarmTx(
                            key,
                            farm.chainId,
                            "Approve LP",
                            () =>
                              approveErc20(
                                farm.pool.address,
                                farm.address,
                                inputAmount || "1000000",
                                18,
                              ),
                          )
                        }
                        className="cursor-pointer rounded-md border border-white/10 bg-[#0C1017] px-2.5 py-1.5 font-mono-tabular text-[11px] font-medium text-slate-200 transition hover:border-teal-400/40 hover:text-teal-300"
                      >
                        1. Approve LP
                      </button>

                      <button
                        type="button"
                        disabled={!farm.isActive}
                        onClick={() =>
                          void executeFarmTx(
                            key,
                            farm.chainId,
                            "Stake LP",
                            () =>
                              stakeInFarm({
                                farmAddress: farm.address,
                                lpTokenAddress: farm.pool.address,
                                amountRaw: inputAmount,
                              }),
                          )
                        }
                        className="cursor-pointer rounded-md bg-teal-400 px-2.5 py-1.5 font-mono-tabular text-[11px] font-semibold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        2. Stake LP
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void executeFarmTx(
                            key,
                            farm.chainId,
                            "Unstake LP",
                            () =>
                              unstakeFromFarm({
                                farmAddress: farm.address,
                                amountRaw: inputAmount || userStaked,
                              }),
                          )
                        }
                        className="cursor-pointer rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 font-mono-tabular text-[11px] font-medium text-amber-300 transition hover:bg-amber-400/20"
                      >
                        Unstake LP
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void executeFarmTx(
                            key,
                            farm.chainId,
                            `Claim ${farm.rewardToken.symbol}`,
                            () =>
                              claimFarmRewards({
                                farmAddress: farm.address,
                              }),
                          )
                        }
                        className="cursor-pointer rounded-md border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-1.5 font-mono-tabular text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-400/25"
                      >
                        Claim Rewards
                      </button>
                    </div>

                    {feedback && (
                      <div
                        className={`mt-2 rounded border p-2 text-[11px] ${
                          feedback.status === "confirmed"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                            : feedback.status === "submitting"
                              ? "border-teal-400/30 bg-teal-400/10 text-teal-200"
                              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 font-mono-tabular">
                          <span className="flex items-center gap-1">
                            {feedback.status === "confirmed" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            ) : feedback.status === "submitting" ? (
                              <Flame className="h-3.5 w-3.5 animate-pulse text-teal-300" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                            )}
                            {feedback.message}
                          </span>
                          {feedback.txHash && (
                            <TxHashLink
                              txHash={feedback.txHash}
                              chainId={feedback.chainId}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4">
                  <div>
                    <span className="font-mono-tabular text-[10px] tracking-wider text-slate-400 uppercase">
                      Your Staked LP
                    </span>
                    <div className="font-mono-tabular text-sm font-semibold text-teal-300">
                      {formatAmount(userStaked, 6)} LP
                    </div>
                  </div>
                  <ChainBadge chainId={farm.chainId} />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Wallet Staking Events History */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0C1017]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-100">
              Your Staking Event Log
            </h2>
            <p className="text-xs text-slate-400">
              Indexed <code className="font-mono-tabular">STAKE</code>,{" "}
              <code className="font-mono-tabular">UNSTAKE</code>, and{" "}
              <code className="font-mono-tabular">CLAIM</code> transactions for
              your wallet.
            </p>
          </div>
          <span className="font-mono-tabular text-xs text-slate-400">
            {stakingEventsQuery.data?.length ?? 0} events
          </span>
        </div>

        {(stakingEventsQuery.data ?? []).length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No staking events indexed for your wallet yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                  <th className="px-6 py-3">Action</th>
                  <th className="px-4 py-3">Farm Pool</th>
                  <th className="px-4 py-3">Chain</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tx Hash</th>
                  <th className="px-6 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {(stakingEventsQuery.data ?? []).map((ev, idx) => (
                  <tr
                    key={`${ev.txHash ?? idx}-${ev.createdAt}`}
                    className="transition hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 font-mono-tabular text-[11px] font-medium ${
                          ev.type === "STAKE"
                            ? "border-teal-400/30 bg-teal-400/10 text-teal-300"
                            : ev.type === "CLAIM"
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                              : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                        }`}
                      >
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
                      {formatAmount(ev.amount, 6)}{" "}
                      {ev.type === "CLAIM"
                        ? ev.farm.rewardToken.symbol
                        : "LP"}
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
