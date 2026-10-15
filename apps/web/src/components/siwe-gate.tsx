"use client"

import React from "react"
import { ArrowRight, KeyRound, Lock, ShieldCheck, Wallet } from "lucide-react"
import { useAuth } from "@/context/auth-context"

export function SiweGate() {
  const { stage, hasInjectedWallet, error, signInWithEthereum } = useAuth()

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.09] bg-[#0C1017]/95 p-8 md:p-12">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/25 bg-teal-400/10 px-3 py-1 font-mono-tabular text-[11px] tracking-widest text-teal-300 uppercase">
            <Lock className="h-3 w-3" />
            EIP-4361 Session Required
          </div>

          <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight text-slate-100 md:text-4xl">
            Authenticate your wallet to unlock the KazeSetu terminal.
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
            In KazeSetu, your wallet address is your identity. All protocol
            projections, LP + Staking valuations, and indexed event streams are
            cryptographically gated via Sign-In with Ethereum (SIWE) and an{" "}
            <code className="font-mono-tabular text-xs text-slate-200">
              httpOnly
            </code>{" "}
            refresh session.
          </p>

          {error && (
            <div className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void signInWithEthereum()}
              disabled={stage === "signing"}
              className="inline-flex items-center gap-2.5 rounded-lg bg-teal-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_25px_rgba(45,212,191,0.3)] transition hover:bg-teal-300 disabled:opacity-60"
            >
              <Wallet className="h-4 w-4" />
              {stage === "signing"
                ? "Awaiting Wallet Signature…"
                : "Sign-In with Ethereum"}
              <ArrowRight className="h-4 w-4" />
            </button>

            <span className="font-mono-tabular text-xs text-slate-500">
              {hasInjectedWallet
                ? "EIP-1193 Provider Detected"
                : "No injected wallet found (install MetaMask / Rabby)"}
            </span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-lg border border-white/[0.08] bg-[#07090E]/90 p-5">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <span className="font-mono-tabular text-[11px] tracking-wider text-slate-400 uppercase">
                SIWE Handshake Pipeline
              </span>
              <span className="font-mono-tabular text-[11px] text-teal-300">
                EIP-4361 · EIP-55
              </span>
            </div>

            <ol className="mt-4 space-y-3.5 text-xs">
              <li className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-teal-400/30 bg-teal-400/10 font-mono-tabular text-[11px] text-teal-300">
                  01
                </span>
                <div>
                  <p className="font-medium text-slate-200">
                    Single-Use DB Nonce
                  </p>
                  <p className="mt-0.5 text-slate-400">
                    Requests{" "}
                    <code className="font-mono-tabular text-slate-300">
                      POST /api/auth/nonce
                    </code>{" "}
                    with a 5-minute TTL stored in Postgres.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-teal-400/30 bg-teal-400/10 font-mono-tabular text-[11px] text-teal-300">
                  02
                </span>
                <div>
                  <p className="font-medium text-slate-200">
                    Zero-Gas Personal Sign
                  </p>
                  <p className="mt-0.5 text-slate-400">
                    Signs an EIP-55 checksummed statement binding{" "}
                    <code className="font-mono-tabular text-slate-300">
                      domain
                    </code>
                    ,{" "}
                    <code className="font-mono-tabular text-slate-300">
                      uri
                    </code>
                    , and{" "}
                    <code className="font-mono-tabular text-slate-300">
                      chainId
                    </code>
                    .
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-teal-400/30 bg-teal-400/10 font-mono-tabular text-[11px] text-teal-300">
                  03
                </span>
                <div>
                  <p className="font-medium text-slate-200">
                    JWT + Rotating Session
                  </p>
                  <p className="mt-0.5 text-slate-400">
                    Issues a 15m Bearer JWT (<code className="font-mono-tabular">USER</code> /{" "}
                    <code className="font-mono-tabular">ADMIN</code>) and a 7d
                    refresh cookie.
                  </p>
                </div>
              </li>
            </ol>

            <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-3 font-mono-tabular text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Replay Protected
              </span>
              <span className="inline-flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
                Zero Custody
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
