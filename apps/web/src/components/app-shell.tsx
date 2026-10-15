"use client"

import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Activity,
  BarChart3,
  Layers,
  LogOut,
  PieChart,
  Shield,
  Sprout,
  Wallet,
  Wind,
} from "lucide-react"
import { api, API_BASE_URL } from "@/lib/api"
import { SUPPORTED_CHAINS } from "@/lib/chains"
import { shortAddress } from "@/lib/format"
import { useAuth } from "@/context/auth-context"
import { SiweGate } from "@/components/siwe-gate"
import { OverviewView } from "@/components/views/overview-view"
import { PortfolioView } from "@/components/views/portfolio-view"
import { PoolsView } from "@/components/views/pools-view"
import { StakingView } from "@/components/views/staking-view"
import { ActivityView } from "@/components/views/activity-view"
import { AdminView } from "@/components/views/admin-view"

export type NavTab =
  | "overview"
  | "portfolio"
  | "pools"
  | "staking"
  | "activity"
  | "admin"

export function AppShell() {
  const [activeTab, setActiveTab] = useState<NavTab>("overview")
  const {
    stage,
    address,
    chainId,
    role,
    signInWithEthereum,
    switchChain,
    signOut,
  } = useAuth()

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: () => api.health(),
    refetchInterval: 20_000,
    retry: false,
  })

  const isApiOnline = healthQuery.data?.status === "ok"

  const navItems: Array<{
    id: NavTab
    label: string
    icon: React.ComponentType<{ className?: string }>
    badge?: string
  }> = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "portfolio", label: "Portfolio", icon: PieChart },
    { id: "pools", label: "Pools", icon: Layers },
    { id: "staking", label: "Staking", icon: Sprout },
    { id: "activity", label: "Activity", icon: Activity },
    {
      id: "admin",
      label: "Ops Console",
      icon: Shield,
      badge: role === "ADMIN" ? "ADMIN" : undefined,
    },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Institutional Telemetry Ribbon */}
      <div className="border-b border-white/[0.06] bg-[#05070B] px-4 py-1.5 font-mono-tabular text-[11px] text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isApiOnline ? "bg-emerald-400" : "bg-rose-400"
                }`}
              />
              <span className="text-slate-300">
                API: {isApiOnline ? "ONLINE" : "OFFLINE"}
              </span>
              <span className="text-slate-600">({API_BASE_URL})</span>
            </span>
            <span className="hidden text-slate-600 sm:inline">|</span>
            <span className="hidden sm:inline">
              SOURCE OF TRUTH:{" "}
              <span className="text-teal-300">ON-CHAIN RESERVES</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span>
              AUTH:{" "}
              <span className="text-slate-200">
                {stage === "authenticated"
                  ? `SIWE (${role ?? "USER"})`
                  : "UNAUTHENTICATED"}
              </span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">KAZESETU v1.0</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#07090E]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          {/* Brand Identity */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className="flex items-center gap-3 text-left"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal-400/40 bg-teal-400/10 text-teal-300 shadow-[0_0_20px_rgba(45,212,191,0.18)]">
                <Wind className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-bold tracking-tight text-slate-100">
                    KazeSetu
                  </span>
                </div>
                <p className="font-mono-tabular text-[10px] tracking-widest text-slate-500 uppercase">
                  Liquidity Terminal
                </p>
              </div>
            </button>

            {/* Primary Navigation Tabs */}
            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition ${
                      isActive
                        ? "border border-teal-400/30 bg-teal-400/12 text-teal-200"
                        : "border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="rounded bg-teal-400/20 px-1.5 py-0.2 font-mono-tabular text-[9px] text-teal-300">
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Right Wallet & Chain Controls */}
          <div className="flex items-center gap-2.5">
            {/* Chain Switcher */}
            <select
              aria-label="Active network"
              value={chainId ?? 1}
              onChange={(e) => void switchChain(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-[#0C1017] px-3 py-2 font-mono-tabular text-xs text-slate-200 focus:border-teal-400/50 focus:outline-none"
            >
              {SUPPORTED_CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.short} · {c.id}
                </option>
              ))}
            </select>

            {stage === "authenticated" && address ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-teal-400/30 bg-[#0C1017] px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="font-mono-tabular text-xs font-medium text-slate-100">
                    {shortAddress(address, 4)}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono-tabular text-[10px] font-semibold ${
                      role === "ADMIN"
                        ? "bg-teal-400/20 text-teal-300"
                        : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {role}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void signOut()}
                  title="Sign out & clear refresh cookie"
                  className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-[#0C1017] p-2 text-slate-400 transition hover:border-rose-500/40 hover:text-rose-300"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void signInWithEthereum()}
                disabled={stage === "signing"}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 font-mono-tabular text-xs font-semibold text-slate-950 shadow-[0_0_20px_rgba(45,212,191,0.25)] transition hover:bg-teal-300 disabled:opacity-60"
              >
                <Wallet className="h-3.5 w-3.5" />
                {stage === "signing" ? "Signing SIWE…" : "Connect & Sign-In"}
              </button>
            )}
          </div>
        </div>

        {/* Mobile / Tablet Navigation Bar */}
        <div className="flex overflow-x-auto border-t border-white/[0.06] px-4 py-2 lg:hidden">
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                    isActive
                      ? "bg-teal-400/15 text-teal-200"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {stage !== "authenticated" ? (
          <SiweGate />
        ) : (
          <>
            {activeTab === "overview" && (
              <OverviewView onNavigate={(tab) => setActiveTab(tab)} />
            )}
            {activeTab === "portfolio" && <PortfolioView />}
            {activeTab === "pools" && <PoolsView />}
            {activeTab === "staking" && <StakingView />}
            {activeTab === "activity" && <ActivityView />}
            {activeTab === "admin" && <AdminView />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/[0.07] bg-[#05070B]/90 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 font-mono-tabular text-xs text-slate-500 sm:flex-row sm:px-6">
          <div>
            KazeSetu Protocol · Non-Custodial Liquidity & Yield Projection
          </div>
          <div className="flex items-center gap-4">
            <span>EIP-4361 SIWE</span>
            <span>·</span>
            <span>Canonical AMM Pairs</span>
            <span>·</span>
            <span>Prisma Decimal Precision</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
