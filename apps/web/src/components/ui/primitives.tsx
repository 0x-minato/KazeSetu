"use client"

import React, { useState } from "react"
import { Check, Copy, ExternalLink } from "lucide-react"
import { chainExplorerAddress, chainExplorerTx, chainLabel } from "@/lib/chains"
import { shortAddress, shortHash } from "@/lib/format"
import type { SwapStatus } from "@/lib/types"

export function StatusPill({ status }: { status: SwapStatus | string }) {
  const styles =
    status === "SUCCESS" || status === "ACTIVE"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : status === "PENDING"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : "border-rose-500/30 bg-rose-500/10 text-rose-300"

  const dot =
    status === "SUCCESS" || status === "ACTIVE"
      ? "bg-emerald-400"
      : status === "PENDING"
        ? "bg-amber-400 animate-pulse"
        : "bg-rose-400"

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono-tabular text-[11px] font-medium tracking-wider uppercase ${styles}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  )
}

export function ChainBadge({ chainId }: { chainId: number }) {
  return (
    <span className="inline-flex items-center rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono-tabular text-[11px] text-slate-300">
      {chainLabel(chainId)}
    </span>
  )
}

export function CopyAddress({
  address,
  chainId,
  chars = 4,
}: {
  address: string
  chainId?: number
  chars?: number
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // ignore
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono-tabular text-xs text-slate-300">
      <span>{shortAddress(address, chars)}</span>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy full address"
        className="cursor-pointer rounded p-0.5 text-slate-500 transition hover:bg-white/5 hover:text-teal-300"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-400" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
      {chainId !== undefined && (
        <a
          href={chainExplorerAddress(chainId, address)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="View on block explorer"
          className="rounded p-0.5 text-slate-500 transition hover:bg-white/5 hover:text-teal-300"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </span>
  )
}

export function TxHashLink({
  txHash,
  chainId,
}: {
  txHash: string | null
  chainId: number
}) {
  if (!txHash) {
    return (
      <span className="font-mono-tabular text-xs text-slate-500">unindexed</span>
    )
  }
  return (
    <a
      href={chainExplorerTx(chainId, txHash)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono-tabular text-xs text-teal-300/90 transition hover:text-teal-200 hover:underline"
    >
      <span>{shortHash(txHash)}</span>
      <ExternalLink className="h-3 w-3 opacity-75" />
    </a>
  )
}

export function TokenPairGlyph({
  symbol0,
  symbol1,
}: {
  symbol0: string
  symbol1: string
}) {
  return (
    <div className="flex items-center -space-x-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-teal-400/40 bg-[#0f1c24] font-mono-tabular text-[10px] font-semibold text-teal-200 shadow-sm">
        {symbol0.slice(0, 3).toUpperCase()}
      </div>
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-indigo-400/40 bg-[#14172b] font-mono-tabular text-[10px] font-semibold text-indigo-200 shadow-sm">
        {symbol1.slice(0, 3).toUpperCase()}
      </div>
    </div>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-5 md:flex-row md:items-end">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
          <span className="font-mono-tabular text-[11px] font-medium tracking-[0.14em] text-teal-300/90 uppercase">
            {eyebrow}
          </span>
        </div>
        <h1 className="font-display mt-1.5 text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2.5">{right}</div>}
    </div>
  )
}
