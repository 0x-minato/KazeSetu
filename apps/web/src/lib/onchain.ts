import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  parseUnits,
  type Address,
  type Hash,
  type TransactionReceipt,
} from "viem"
import type { Eip1193Provider } from "@/context/auth-context"

export const KAZE_CL_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [
      {
        name: "myPosition",
        type: "tuple",
        components: [
          { name: "liquidity", type: "uint256" },
          { name: "amount0", type: "uint256" },
          { name: "amount1", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "handle_fees",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "rebalance",
    stateMutability: "nonpayable",
    inputs: [
      { name: "new_lower_tick", type: "int24" },
      { name: "new_upper_tick", type: "int24" },
      { name: "amount_out_min", type: "uint256" },
    ],
    outputs: [
      { name: "new_liquidity", type: "uint256" },
      { name: "amount0_used", type: "uint256" },
      { name: "amount1_used", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "pause",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "unpause",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

export const STAKING_FARM_ABI = [
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "unstake",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "earned",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

export const UNISWAP_V3_SWAP_ROUTER_ABI = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const

export interface OnChainTxResult {
  hash: Hash
  receipt: TransactionReceipt
}

const getInjectedProvider = (): Eip1193Provider => {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error(
      "No EIP-1193 browser wallet detected. Unlock MetaMask, Rabby, or Coinbase Wallet.",
    )
  }
  const eth = window.ethereum
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    return (
      eth.providers.find((p) => p.isRabby || p.isMetaMask) ?? eth.providers[0]
    )
  }
  return eth
}

const getClientsAndAccount = async () => {
  const provider = getInjectedProvider()
  const transport = custom(provider)
  const walletClient = createWalletClient({ transport })
  const publicClient = createPublicClient({ transport })

  const accounts = await walletClient.requestAddresses()
  const account = accounts[0]
  if (!account) {
    throw new Error("No wallet account authorized by provider.")
  }

  return { walletClient, publicClient, account }
}

const safeParseUnits = (raw: string, decimals = 18): bigint => {
  const clean = raw.trim()
  if (!clean || Number(clean) <= 0) return 0n
  return parseUnits(clean, decimals)
}

export { formatUnits, parseUnits }

export async function approveErc20(
  tokenAddress: string,
  spenderAddress: string,
  amountRaw: string,
  decimals = 18,
): Promise<OnChainTxResult> {
  const { walletClient, publicClient, account } = await getClientsAndAccount()
  const amount = safeParseUnits(amountRaw, decimals)
  if (amount <= 0n) {
    throw new Error("Approve amount must be greater than 0.")
  }

  const hash = await walletClient.writeContract({
    account,
    chain: null,
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spenderAddress as Address, amount],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return { hash, receipt }
}

export async function depositToVault(params: {
  vaultAddress: string
  amount0Raw: string
  amount1Raw: string
  decimals0?: number
  decimals1?: number
  amountOutMinRaw?: string
  receiver?: string
}): Promise<OnChainTxResult> {
  const { walletClient, publicClient, account } = await getClientsAndAccount()
  const amount0 = safeParseUnits(params.amount0Raw, params.decimals0 ?? 18)
  const amount1 = safeParseUnits(params.amount1Raw, params.decimals1 ?? 18)
  const amountOutMin = safeParseUnits(params.amountOutMinRaw ?? "0", 18)

  if (amount0 <= 0n && amount1 <= 0n) {
    throw new Error("Enter a positive amount0 or amount1 to deposit.")
  }

  const receiver = (params.receiver?.trim() || account) as Address

  const hash = await walletClient.writeContract({
    account,
    chain: null,
    address: params.vaultAddress as Address,
    abi: KAZE_CL_VAULT_ABI,
    functionName: "deposit",
    args: [amount0, amount1, amountOutMin, receiver],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return { hash, receipt }
}

export async function withdrawFromVault(params: {
  vaultAddress: string
  sharesRaw: string
  receiver?: string
}): Promise<OnChainTxResult> {
  const { walletClient, publicClient, account } = await getClientsAndAccount()
  const shares = safeParseUnits(params.sharesRaw, 18)
  if (shares <= 0n) {
    throw new Error("Shares to withdraw must be greater than 0.")
  }

  const receiver = (params.receiver?.trim() || account) as Address

  const hash = await walletClient.writeContract({
    account,
    chain: null,
    address: params.vaultAddress as Address,
    abi: KAZE_CL_VAULT_ABI,
    functionName: "withdraw",
    args: [shares, receiver],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return { hash, receipt }
}

export async function compoundVaultFees(params: {
  vaultAddress: string
}): Promise<OnChainTxResult> {
  const { walletClient, publicClient, account } = await getClientsAndAccount()

  const hash = await walletClient.writeContract({
    account,
    chain: null,
    address: params.vaultAddress as Address,
    abi: KAZE_CL_VAULT_ABI,
    functionName: "handle_fees",
    args: [],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return { hash, receipt }
}

export async function rebalanceVault(params: {
  vaultAddress: string
  newTickLower: number
  newTickUpper: number
  amountOutMinRaw?: string
}): Promise<OnChainTxResult> {
  const { walletClient, publicClient, account } = await getClientsAndAccount()
  if (params.newTickLower >= params.newTickUpper) {
    throw new Error("newTickLower must be strictly less than newTickUpper.")
  }

  const amountOutMin = safeParseUnits(params.amountOutMinRaw ?? "0", 18)

  const hash = await walletClient.writeContract({
    account,
    chain: null,
    address: params.vaultAddress as Address,
    abi: KAZE_CL_VAULT_ABI,
    functionName: "rebalance",
    args: [params.newTickLower, params.newTickUpper, amountOutMin],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return { hash, receipt }
}

export async function setVaultPause(params: {
  vaultAddress: string
  pause: boolean
}): Promise<OnChainTxResult> {
  const { walletClient, publicClient, account } = await getClientsAndAccount()

  const hash = await walletClient.writeContract({
    account,
    chain: null,
    address: params.vaultAddress as Address,
    abi: KAZE_CL_VAULT_ABI,
    functionName: params.pause ? "pause" : "unpause",
    args: [],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return { hash, receipt }
}

export async function stakeInFarm(params: {
  farmAddress: string
  lpTokenAddress: string
  amountRaw: string
  approveFirst?: boolean
}): Promise<OnChainTxResult> {
  const { walletClient, publicClient, account } = await getClientsAndAccount()
  const amount = safeParseUnits(params.amountRaw, 18)
  if (amount <= 0n) {
    throw new Error("LP stake amount must be greater than 0.")
  }

  if (params.approveFirst) {
    const approveHash = await walletClient.writeContract({
      account,
      chain: null,
      address: params.lpTokenAddress as Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [params.farmAddress as Address, amount],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveHash })
  }

  const hash = await walletClient.writeContract({
    account,
    chain: null,
    address: params.farmAddress as Address,
    abi: STAKING_FARM_ABI,
    functionName: "stake",
    args: [amount],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return { hash, receipt }
}

export async function unstakeFromFarm(params: {
  farmAddress: string
  amountRaw: string
}): Promise<OnChainTxResult> {
  const { walletClient, publicClient, account } = await getClientsAndAccount()
  const amount = safeParseUnits(params.amountRaw, 18)
  if (amount <= 0n) {
    throw new Error("LP unstake amount must be greater than 0.")
  }

  const hash = await walletClient.writeContract({
    account,
    chain: null,
    address: params.farmAddress as Address,
    abi: STAKING_FARM_ABI,
    functionName: "unstake",
    args: [amount],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return { hash, receipt }
}

export async function claimFarmRewards(params: {
  farmAddress: string
}): Promise<OnChainTxResult> {
  const { walletClient, publicClient, account } = await getClientsAndAccount()

  const hash = await walletClient.writeContract({
    account,
    chain: null,
    address: params.farmAddress as Address,
    abi: STAKING_FARM_ABI,
    functionName: "claim",
    args: [],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return { hash, receipt }
}

export async function executeExactInputSingleSwap(params: {
  routerAddress: string
  tokenIn: string
  tokenOut: string
  fee: number
  recipient?: string
  amountInRaw: string
  decimalsIn?: number
  amountOutMinRaw?: string
  decimalsOut?: number
}): Promise<OnChainTxResult> {
  const { walletClient, publicClient, account } = await getClientsAndAccount()
  const amountIn = safeParseUnits(params.amountInRaw, params.decimalsIn ?? 18)
  if (amountIn <= 0n) {
    throw new Error("Swap amountIn must be greater than 0.")
  }
  const amountOutMinimum = safeParseUnits(
    params.amountOutMinRaw ?? "0",
    params.decimalsOut ?? 18,
  )
  const recipient = (params.recipient?.trim() || account) as Address
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)

  const hash = await walletClient.writeContract({
    account,
    chain: null,
    address: params.routerAddress as Address,
    abi: UNISWAP_V3_SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: params.tokenIn as Address,
        tokenOut: params.tokenOut as Address,
        fee: params.fee,
        recipient,
        deadline,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  return { hash, receipt }
}
