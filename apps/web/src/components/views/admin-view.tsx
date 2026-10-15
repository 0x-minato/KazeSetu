"use client"

import React, { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2,
  Coins,
  Database,
  KeyRound,
  Layers,
  ShieldAlert,
  Sprout,
  Wrench,
} from "lucide-react"
import { api } from "@/lib/api"
import { SUPPORTED_CHAINS } from "@/lib/chains"
import { useAuth } from "@/context/auth-context"
import { SectionHeader } from "@/components/ui/primitives"

export function AdminView() {
  const { role, address } = useAuth()
  const queryClient = useQueryClient()
  const [workerKey, setWorkerKey] = useState("")
  const [banner, setBanner] = useState<{
    kind: "ok" | "err"
    text: string
  } | null>(null)

  // 1. Register Token state
  const [tokenForm, setTokenForm] = useState({
    chainId: 1,
    address: "",
    symbol: "",
    name: "",
    decimals: 18,
  })

  // 2. Oracle Price Update state
  const [priceForm, setPriceForm] = useState({
    chainId: 1,
    address: "",
    priceUsd: "",
  })

  // 3. Create Pool state
  const [poolForm, setPoolForm] = useState({
    chainId: 1,
    address: "",
    token0Address: "",
    token1Address: "",
    feeBps: 30,
    reserve0: "0",
    reserve1: "0",
    totalSupply: "0",
  })

  // 4. Update Pool Reserves/State
  const [poolStateForm, setPoolStateForm] = useState({
    chainId: 1,
    address: "",
    reserve0: "",
    reserve1: "",
    totalSupply: "",
    isActive: true,
  })

  // 5. Create Staking Farm
  const [farmForm, setFarmForm] = useState({
    chainId: 1,
    address: "",
    poolAddress: "",
    rewardTokenAddress: "",
  })

  const invalidateProtocolQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tokens"] }),
      queryClient.invalidateQueries({ queryKey: ["prices"] }),
      queryClient.invalidateQueries({ queryKey: ["pools"] }),
      queryClient.invalidateQueries({ queryKey: ["staking"] }),
      queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
    ])
  }

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault()
    setBanner(null)
    try {
      const created = await api.tokens.create({
        chainId: tokenForm.chainId,
        address: tokenForm.address.trim(),
        symbol: tokenForm.symbol.trim(),
        name: tokenForm.name.trim(),
        decimals: Number(tokenForm.decimals),
        isActive: true,
      })
      await invalidateProtocolQueries()
      setBanner({
        kind: "ok",
        text: `Token ${created.symbol} (${created.address}) allowlisted on chain ${created.chainId}.`,
      })
    } catch (err) {
      setBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to create token",
      })
    }
  }

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault()
    setBanner(null)
    try {
      const updated = await api.prices.update(
        priceForm.address.trim(),
        priceForm.chainId,
        priceForm.priceUsd.trim(),
        workerKey,
      )
      await invalidateProtocolQueries()
      setBanner({
        kind: "ok",
        text: `Updated ${updated.symbol} price to $${updated.priceUsd} on chain ${updated.chainId}.`,
      })
    } catch (err) {
      setBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to update price",
      })
    }
  }

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault()
    setBanner(null)
    try {
      const created = await api.pools.create({
        chainId: poolForm.chainId,
        address: poolForm.address.trim(),
        token0Address: poolForm.token0Address.trim(),
        token1Address: poolForm.token1Address.trim(),
        feeBps: Number(poolForm.feeBps),
        reserve0: poolForm.reserve0.trim(),
        reserve1: poolForm.reserve1.trim(),
        totalSupply: poolForm.totalSupply.trim(),
        isActive: true,
      })
      await invalidateProtocolQueries()
      setBanner({
        kind: "ok",
        text: `Pool ${created.token0.symbol}/${created.token1.symbol} (${created.address}) created with canonical ordering.`,
      })
    } catch (err) {
      setBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to create pool",
      })
    }
  }

  const handleUpdatePoolState = async (e: React.FormEvent) => {
    e.preventDefault()
    setBanner(null)
    try {
      const updated = await api.pools.updateState(
        poolStateForm.address.trim(),
        poolStateForm.chainId,
        {
          reserve0: poolStateForm.reserve0.trim(),
          reserve1: poolStateForm.reserve1.trim(),
          totalSupply: poolStateForm.totalSupply.trim(),
          isActive: poolStateForm.isActive,
        },
        workerKey,
      )
      await invalidateProtocolQueries()
      setBanner({
        kind: "ok",
        text: `Synchronized reserves for ${updated.token0.symbol}/${updated.token1.symbol} (${updated.address}).`,
      })
    } catch (err) {
      setBanner({
        kind: "err",
        text:
          err instanceof Error ? err.message : "Failed to update pool reserves",
      })
    }
  }

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault()
    setBanner(null)
    try {
      const created = await api.staking.createFarm({
        chainId: farmForm.chainId,
        address: farmForm.address.trim(),
        poolAddress: farmForm.poolAddress.trim(),
        rewardTokenAddress: farmForm.rewardTokenAddress.trim(),
        isActive: true,
      })
      await invalidateProtocolQueries()
      setBanner({
        kind: "ok",
        text: `Staking farm ${created.address} registered for ${created.pool.token0.symbol}/${created.pool.token1.symbol}.`,
      })
    } catch (err) {
      setBanner({
        kind: "err",
        text:
          err instanceof Error ? err.message : "Failed to create staking farm",
      })
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Protocol Governance // ADMIN_ADDRESS & Worker Key"
        title="Protocol Operations Console"
        subtitle="Manage allowlisted tokens, canonical AMM pools, yield farms, and oracle/reserve synchronization."
        right={
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0C1017] px-3 py-1.5 font-mono-tabular text-xs">
            <span className="text-slate-400">JWT Role:</span>
            <span
              className={
                role === "ADMIN"
                  ? "font-semibold text-teal-300"
                  : "text-amber-300"
              }
            >
              {role ?? "USER"}
            </span>
          </div>
        }
      />

      {role !== "ADMIN" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold">
              Connected wallet ({address}) is not ADMIN_ADDRESS
            </p>
            <p className="mt-0.5 text-amber-200/80">
              Admin-only endpoints (<code className="font-mono-tabular">POST /api/tokens</code>,{" "}
              <code className="font-mono-tabular">POST /api/pools</code>,{" "}
              <code className="font-mono-tabular">POST /api/staking</code>) require{" "}
              <code className="font-mono-tabular">role === &quot;ADMIN&quot;</code>. However,{" "}
              <code className="font-mono-tabular">PUT /api/prices/:address</code> and{" "}
              <code className="font-mono-tabular">PUT /api/pools/:address</code> also accept{" "}
              <code className="font-mono-tabular">x-worker-key</code> below.
            </p>
          </div>
        </div>
      )}

      {/* Optional Worker Key Header Input */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0C1017] p-4 md:flex-row md:items-center">
        <div className="flex items-center gap-2.5">
          <KeyRound className="h-4 w-4 text-teal-400" />
          <div>
            <div className="text-xs font-medium text-slate-200">
              Optional <code className="font-mono-tabular">x-worker-key</code>{" "}
              Header
            </div>
            <div className="text-[11px] text-slate-400">
              Used for <code className="font-mono-tabular">authenticateWorkerOrAdmin</code>{" "}
              routes (Price Oracle PUT & Pool Reserves PUT).
            </div>
          </div>
        </div>
        <input
          type="password"
          value={workerKey}
          onChange={(e) => setWorkerKey(e.target.value)}
          placeholder="Enter WORKER_API_KEY (optional if signed in as ADMIN)"
          className="w-full rounded-lg border border-white/10 bg-[#07090E] px-3.5 py-2 font-mono-tabular text-xs text-slate-100 placeholder-slate-500 focus:border-teal-400/50 focus:outline-none md:w-96"
        />
      </div>

      {banner && (
        <div
          className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs ${
            banner.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{banner.text}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. Allowlist Token */}
        <form
          onSubmit={handleCreateToken}
          className="space-y-4 rounded-xl border border-white/[0.08] bg-[#0C1017] p-6"
        >
          <div className="flex items-center gap-2 border-b border-white/[0.07] pb-3">
            <Coins className="h-4 w-4 text-teal-400" />
            <h3 className="font-display text-sm font-semibold text-slate-100">
              1. Allowlist / Reactivate Token (POST /api/tokens)
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Chain
              </label>
              <select
                value={tokenForm.chainId}
                onChange={(e) =>
                  setTokenForm({
                    ...tokenForm,
                    chainId: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              >
                {SUPPORTED_CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Decimals (0–18)
              </label>
              <input
                type="number"
                min={0}
                max={18}
                value={tokenForm.decimals}
                onChange={(e) =>
                  setTokenForm({
                    ...tokenForm,
                    decimals: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Symbol
              </label>
              <input
                type="text"
                required
                placeholder="WETH"
                value={tokenForm.symbol}
                onChange={(e) =>
                  setTokenForm({ ...tokenForm, symbol: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Name
              </label>
              <input
                type="text"
                required
                placeholder="Wrapped Ether"
                value={tokenForm.name}
                onChange={(e) =>
                  setTokenForm({ ...tokenForm, name: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Contract Address
              </label>
              <input
                type="text"
                required
                placeholder="0x…"
                value={tokenForm.address}
                onChange={(e) =>
                  setTokenForm({ ...tokenForm, address: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-teal-400 px-4 py-2 font-mono-tabular text-xs font-semibold text-slate-950 transition hover:bg-teal-300"
          >
            Allowlist Token
          </button>
        </form>

        {/* 2. Update Token Oracle Price */}
        <form
          onSubmit={handleUpdatePrice}
          className="space-y-4 rounded-xl border border-white/[0.08] bg-[#0C1017] p-6"
        >
          <div className="flex items-center gap-2 border-b border-white/[0.07] pb-3">
            <Database className="h-4 w-4 text-indigo-400" />
            <h3 className="font-display text-sm font-semibold text-slate-100">
              2. Push Oracle Price (PUT /api/prices/:address)
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Chain
              </label>
              <select
                value={priceForm.chainId}
                onChange={(e) =>
                  setPriceForm({
                    ...priceForm,
                    chainId: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              >
                {SUPPORTED_CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                USD Price (Decimal String)
              </label>
              <input
                type="text"
                required
                placeholder="3245.50"
                value={priceForm.priceUsd}
                onChange={(e) =>
                  setPriceForm({ ...priceForm, priceUsd: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Token Address
              </label>
              <input
                type="text"
                required
                placeholder="0x…"
                value={priceForm.address}
                onChange={(e) =>
                  setPriceForm({ ...priceForm, address: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-500 px-4 py-2 font-mono-tabular text-xs font-semibold text-white transition hover:bg-indigo-400"
          >
            Update Cached USD Price
          </button>
        </form>

        {/* 3. Create Canonical Liquidity Pool */}
        <form
          onSubmit={handleCreatePool}
          className="space-y-4 rounded-xl border border-white/[0.08] bg-[#0C1017] p-6"
        >
          <div className="flex items-center gap-2 border-b border-white/[0.07] pb-3">
            <Layers className="h-4 w-4 text-teal-400" />
            <h3 className="font-display text-sm font-semibold text-slate-100">
              3. Register AMM Pool (POST /api/pools)
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Chain
              </label>
              <select
                value={poolForm.chainId}
                onChange={(e) =>
                  setPoolForm({ ...poolForm, chainId: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              >
                {SUPPORTED_CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Fee (bps, 1–10000)
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                value={poolForm.feeBps}
                onChange={(e) =>
                  setPoolForm({ ...poolForm, feeBps: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Pool Contract Address
              </label>
              <input
                type="text"
                required
                placeholder="0x…"
                value={poolForm.address}
                onChange={(e) =>
                  setPoolForm({ ...poolForm, address: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Token A Address
              </label>
              <input
                type="text"
                required
                placeholder="0x…"
                value={poolForm.token0Address}
                onChange={(e) =>
                  setPoolForm({ ...poolForm, token0Address: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Token B Address
              </label>
              <input
                type="text"
                required
                placeholder="0x…"
                value={poolForm.token1Address}
                onChange={(e) =>
                  setPoolForm({ ...poolForm, token1Address: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Initial Reserve 0
              </label>
              <input
                type="text"
                value={poolForm.reserve0}
                onChange={(e) =>
                  setPoolForm({ ...poolForm, reserve0: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Initial Reserve 1
              </label>
              <input
                type="text"
                value={poolForm.reserve1}
                onChange={(e) =>
                  setPoolForm({ ...poolForm, reserve1: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Initial LP Total Supply
              </label>
              <input
                type="text"
                value={poolForm.totalSupply}
                onChange={(e) =>
                  setPoolForm({ ...poolForm, totalSupply: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-teal-400 px-4 py-2 font-mono-tabular text-xs font-semibold text-slate-950 transition hover:bg-teal-300"
          >
            Create Canonical Pool
          </button>
        </form>

        {/* 4. Synchronize Pool Reserves & Supply */}
        <form
          onSubmit={handleUpdatePoolState}
          className="space-y-4 rounded-xl border border-white/[0.08] bg-[#0C1017] p-6"
        >
          <div className="flex items-center gap-2 border-b border-white/[0.07] pb-3">
            <Wrench className="h-4 w-4 text-indigo-400" />
            <h3 className="font-display text-sm font-semibold text-slate-100">
              4. Sync Pool Reserves (PUT /api/pools/:address)
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Chain
              </label>
              <select
                value={poolStateForm.chainId}
                onChange={(e) =>
                  setPoolStateForm({
                    ...poolStateForm,
                    chainId: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              >
                {SUPPORTED_CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Pool Address
              </label>
              <input
                type="text"
                required
                placeholder="0x…"
                value={poolStateForm.address}
                onChange={(e) =>
                  setPoolStateForm({
                    ...poolStateForm,
                    address: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Reserve 0
              </label>
              <input
                type="text"
                required
                placeholder="1000.0"
                value={poolStateForm.reserve0}
                onChange={(e) =>
                  setPoolStateForm({
                    ...poolStateForm,
                    reserve0: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Reserve 1
              </label>
              <input
                type="text"
                required
                placeholder="3200000.0"
                value={poolStateForm.reserve1}
                onChange={(e) =>
                  setPoolStateForm({
                    ...poolStateForm,
                    reserve1: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Total LP Supply
              </label>
              <input
                type="text"
                required
                placeholder="56568.54"
                value={poolStateForm.totalSupply}
                onChange={(e) =>
                  setPoolStateForm({
                    ...poolStateForm,
                    totalSupply: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-500 px-4 py-2 font-mono-tabular text-xs font-semibold text-white transition hover:bg-indigo-400"
          >
            Sync Reserves & Supply
          </button>
        </form>

        {/* 5. Register Yield Farm */}
        <form
          onSubmit={handleCreateFarm}
          className="space-y-4 rounded-xl border border-white/[0.08] bg-[#0C1017] p-6 lg:col-span-2"
        >
          <div className="flex items-center gap-2 border-b border-white/[0.07] pb-3">
            <Sprout className="h-4 w-4 text-emerald-400" />
            <h3 className="font-display text-sm font-semibold text-slate-100">
              5. Register Staking Farm (POST /api/staking)
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Chain
              </label>
              <select
                value={farmForm.chainId}
                onChange={(e) =>
                  setFarmForm({ ...farmForm, chainId: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              >
                {SUPPORTED_CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Farm Contract Address
              </label>
              <input
                type="text"
                required
                placeholder="0x…"
                value={farmForm.address}
                onChange={(e) =>
                  setFarmForm({ ...farmForm, address: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Pool Address
              </label>
              <input
                type="text"
                required
                placeholder="0x…"
                value={farmForm.poolAddress}
                onChange={(e) =>
                  setFarmForm({ ...farmForm, poolAddress: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block font-mono-tabular text-[11px] text-slate-400">
                Reward Token Address
              </label>
              <input
                type="text"
                required
                placeholder="0x…"
                value={farmForm.rewardTokenAddress}
                onChange={(e) =>
                  setFarmForm({
                    ...farmForm,
                    rewardTokenAddress: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#07090E] px-3 py-2 font-mono-tabular text-xs text-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-emerald-400 px-5 py-2 font-mono-tabular text-xs font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            Register Staking Farm
          </button>
        </form>
      </div>
    </div>
  )
}
