export const shortAddress = (address?: string | null, chars = 4): string => {
  if (!address) return "—"
  if (address.length <= chars * 2 + 2) return address
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

export const shortHash = (hash?: string | null): string => {
  if (!hash) return "pending"
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

export const formatUsd = (
  raw: string | number | null | undefined,
  compact = false,
): string => {
  const num = typeof raw === "number" ? raw : Number(raw ?? 0)
  if (!Number.isFinite(num)) return "$0.00"

  const sign = num < 0 ? "-" : ""
  const abs = Math.abs(num)

  if (compact && abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
  }
  if (compact && abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  }
  if (compact && abs >= 10_000) {
    return `${sign}$${(abs / 1_000).toFixed(2)}K`
  }

  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: abs > 0 && abs < 1 ? 6 : 2,
  })}`
}

export const formatAmount = (
  raw: string | number | null | undefined,
  maxDecimals = 6,
): string => {
  if (raw === null || raw === undefined || raw === "") return "0"
  const str = String(raw).trim()
  const num = Number(str)
  if (!Number.isFinite(num)) return str
  if (num === 0) return "0"

  if (Math.abs(num) < 0.000001) {
    const [intPart, decPart = ""] = str.split(".")
    return `${intPart}.${decPart.slice(0, 8)}…`
  }

  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  })
}

export const formatBps = (feeBps: number): string => {
  const pct = feeBps / 100
  return `${pct.toFixed(pct % 1 === 0 ? 0 : 2)}%`
}

export const formatTimestamp = (iso: string | Date): string => {
  const date = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}
