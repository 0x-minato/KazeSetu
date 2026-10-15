export interface SupportedChain {
  id: number
  name: string
  short: string
  explorer: string
}

export const SUPPORTED_CHAINS: SupportedChain[] = [
  {
    id: 1,
    name: "Ethereum Mainnet",
    short: "ETH",
    explorer: "https://etherscan.io",
  },
  {
    id: 11155111,
    name: "Sepolia",
    short: "SEP",
    explorer: "https://sepolia.etherscan.io",
  },
  {
    id: 8453,
    name: "Base",
    short: "BASE",
    explorer: "https://basescan.org",
  },
  {
    id: 42161,
    name: "Arbitrum One",
    short: "ARB",
    explorer: "https://arbiscan.io",
  },
]

export const chainLabel = (chainId: number): string => {
  const found = SUPPORTED_CHAINS.find((c) => c.id === chainId)
  return found ? `${found.short} · ${found.id}` : `CHAIN ${chainId}`
}

export const chainExplorerTx = (chainId: number, txHash: string): string => {
  const found = SUPPORTED_CHAINS.find((c) => c.id === chainId)
  const base = found?.explorer ?? "https://etherscan.io"
  return `${base}/tx/${txHash}`
}

export const chainExplorerAddress = (
  chainId: number,
  address: string,
): string => {
  const found = SUPPORTED_CHAINS.find((c) => c.id === chainId)
  const base = found?.explorer ?? "https://etherscan.io"
  return `${base}/address/${address}`
}
