# Frontend Application Documentation (`apps/web/`)

## Overview

`apps/web` is the **KazeSetu Institutional Liquidity & DeFi Terminal**, built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4**, **TanStack React Query v5**, and **viem**.

In accordance with the KazeSetu architecture rules, `apps/web` is strictly responsible for:
1. **UI & Data Visualization**
2. **User Interactions**
3. **Wallet Integration (EIP-1193 / EIP-6963 & SIWE EIP-4361)**
4. **API Communication & Direct On-Chain Transaction Signing**

All portfolio accounting, canonical token ordering, and USD valuation math live in `apps/api` and `contracts/`.

---

## Directory Structure

```text
apps/web/
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── src/
    ├── app/
    │   ├── globals.css                    # Obsidian theme variables, tabular-nums, pointer cursors, grid background
    │   ├── layout.tsx                     # Space Grotesk, Inter, and JetBrains Mono fonts + Providers wrapper
    │   └── page.tsx                       # Root terminal entry rendering <AppShell />
    ├── context/
    │   └── auth-context.tsx               # EIP-6963 / EIP-1193 wallet discovery, SIWE flow, chain switcher, JWT identity
    ├── lib/
    │   ├── api.ts                         # Typed HTTP client for { success, data } envelope + 401 refresh interceptor
    │   ├── chains.ts                      # Supported chain metadata (Ethereum, Sepolia, Base, Arbitrum) & explorer links
    │   ├── format.ts                      # Tabular USD, token amount, basis points, address, and timestamp formatters
    │   ├── onchain.ts                     # Direct viem contract write helpers (KazeClVault, StakingFarm, SwapRouter, ERC20)
    │   ├── siwe.ts                        # Pure-TS Keccak-256 EIP-55 checksummer, EIP-4361 message builder, JWT decoder
    │   └── types.ts                       # TypeScript interfaces matching all API DTOs
    └── components/
        ├── app-shell.tsx                  # Telemetry ribbon, navigation bar, Notifications Bell + Drawer, Wallet controls
        ├── providers.tsx                  # QueryClientProvider + AuthProvider
        ├── siwe-gate.tsx                  # Cryptographic SIWE sign-in gate for unauthenticated sessions
        ├── ui/
        │   └── primitives.tsx             # StatusPill, ChainBadge, CopyAddress, TxHashLink, TokenPairGlyph, SectionHeader
        └── views/
            ├── overview-view.tsx          # Protocol TVL, 24h Volume, 24h Net Liquidity, Top Pools, Oracle Matrix, Farms & Vaults
            ├── vaults-view.tsx            # KazeClVault terminal: tick range bar, Deposit/Withdraw/Compound/Rebalance execution
            ├── portfolio-view.tsx         # Net Worth statement: Consolidated Pool LP + Staked LP + CL Vault share positions
            ├── pools-view.tsx             # AMM Pool Explorer + Depth Inspector + On-Chain Swap Executor
            ├── staking-view.tsx           # Yield Farm cards with inline Approve/Stake/Unstake/Claim + Staking Event Log
            ├── activity-view.tsx          # Swaps, LP, Staking & CL Vault event streams + Deterministic TxHash Inspector
            └── admin-view.tsx             # Protocol Ops Console (7 forms for Tokens, Prices, Pools, Farms, and CL Vaults)
```

---

## State Management Architecture

`apps/web` uses a **3-tier state management model**:
1. **Server & Protocol Projection State (`@tanstack/react-query`)**:
   - Caches and synchronizes all API reads (`["analytics", "overview"]`, `["vaults", "list"]`, `["portfolio", "me"]`, `["pools", "list"]`, `["prices", "list"]`, `["notifications", "me"]`, etc.).
   - Automatically invalidates and refetches affected query keys after any on-chain transaction confirmation or Admin/Ops mutation.
2. **Wallet & SIWE Session State (`AuthContext` + Access Token Pub/Sub Store)**:
   - Discovers browser wallets via **EIP-6963** (`eip6963:announceProvider`) and `window.ethereum`.
   - Builds EIP-55 checksummed EIP-4361 SIWE messages (`src/lib/siwe.ts`), signs via `personal_sign`, and exchanges `{ message, signature }` at `POST /api/auth/verify`.
   - Automatically intercepts `401 Unauthorized` responses in `src/lib/api.ts`, calls `POST /api/auth/refresh` using the `httpOnly` cookie, updates `sessionStorage`, and retries the original request transparently.
3. **Co-located UI State (`useState` / `useMemo`)**:
   - Search filters, chain filter pills, selected inspector rows, and transaction lifecycle banners stay co-located inside their respective view components.

---

## On-Chain Contract Execution (`src/lib/onchain.ts`)

Using `viem` (`createWalletClient`, `createPublicClient`, `custom(window.ethereum)`) and the shared ABIs from `@kazesetu/shared`, users can sign and broadcast real transactions directly from the UI:

| Action | Contract ABI | Method Called | UI Location |
|---|---|---|---|
| Approve Token | `ERC20_ABI` | `approve(spender, amount)` | `VaultsView`, `PoolsView`, `StakingView` |
| Deposit to CL Vault | `KAZE_CL_VAULT_ABI` | `deposit(amount0, amount1, amountOutMin, receiver)` | `VaultsView` (Deposit tab) |
| Withdraw from CL Vault | `KAZE_CL_VAULT_ABI` | `withdraw(shares, receiver)` | `VaultsView` (Withdraw tab) |
| Compound Vault Fees | `KAZE_CL_VAULT_ABI` | `handle_fees()` | `VaultsView` (Fees & Range tab) |
| Rebalance Vault Range | `KAZE_CL_VAULT_ABI` | `rebalance(new_lower_tick, new_upper_tick, amount_out_min)` | `VaultsView` (Governor controls) |
| Pause / Unpause Vault | `KAZE_CL_VAULT_ABI` | `pause()` / `unpause()` | `VaultsView` (Governor controls) |
| Execute Swap | `UNISWAP_V3_SWAP_ROUTER_ABI` | `exactInputSingle(params)` | `PoolsView` (On-Chain Swap Executor) |
| Stake / Unstake / Claim | `STAKING_FARM_ABI` | `stake(amount)` / `unstake(amount)` / `claim()` | `StakingView` (Farm cards) |

---

## Running the Frontend

```bash
cd apps/web
npm install
npm run dev      # Starts on http://localhost:5173 (matching SIWE_URI in apps/api)
```

For production verification:
```bash
cd apps/web
npm run typecheck
npm run build
```
