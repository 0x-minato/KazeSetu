import type { Role } from "./types"

// Exact Keccak-256 over ASCII for EIP-55 mixed-case address checksums
// Required by siwe v3 on the API when parsing EIP-4361 messages.
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
  0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
  0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
  0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
  0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
]

const ROT = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
]

const MASK_64 = (1n << 64n) - 1n

const rotl64 = (x: bigint, n: number): bigint => {
  if (n === 0) return x & MASK_64
  const bn = BigInt(n)
  return ((x << bn) | ((x & MASK_64) >> (64n - bn))) & MASK_64
}

export const keccak256Ascii = (input: string): string => {
  const bytes = new TextEncoder().encode(input)
  const rate = 136
  const paddedLen = Math.ceil((bytes.length + 1) / rate) * rate
  const buf = new Uint8Array(paddedLen)
  buf.set(bytes)
  buf[bytes.length] = 0x01
  buf[paddedLen - 1] |= 0x80

  const state: bigint[] = new Array(25).fill(0n)

  for (let offset = 0; offset < paddedLen; offset += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n
      for (let b = 0; b < 8; b++) {
        lane |= BigInt(buf[offset + i * 8 + b]) << BigInt(8 * b)
      }
      state[i] ^= lane
    }

    for (let round = 0; round < 24; round++) {
      const C: bigint[] = new Array(5).fill(0n)
      for (let x = 0; x < 5; x++) {
        C[x] =
          state[x] ^
          state[x + 5] ^
          state[x + 10] ^
          state[x + 15] ^
          state[x + 20]
      }
      const D: bigint[] = new Array(5).fill(0n)
      for (let x = 0; x < 5; x++) {
        D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1)
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + 5 * y] = (state[x + 5 * y] ^ D[x]) & MASK_64
        }
      }

      const B: bigint[] = new Array(25).fill(0n)
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(
            state[x + 5 * y],
            ROT[x][y],
          )
        }
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + 5 * y] =
            (B[x + 5 * y] ^
              (~B[((x + 1) % 5) + 5 * y] & MASK_64 & B[((x + 2) % 5) + 5 * y])) &
            MASK_64
        }
      }

      state[0] = (state[0] ^ RC[round]) & MASK_64
    }
  }

  let hex = ""
  for (let i = 0; i < 4; i++) {
    const lane = state[i]
    for (let b = 0; b < 8; b++) {
      const byte = Number((lane >> BigInt(8 * b)) & 0xffn)
      hex += byte.toString(16).padStart(2, "0")
    }
  }
  return hex
}

export const toChecksumAddress = (address: string): string => {
  const clean = address.trim().toLowerCase().replace(/^0x/, "")
  if (!/^[0-9a-f]{40}$/.test(clean)) return address
  const hash = keccak256Ascii(clean)
  let out = "0x"
  for (let i = 0; i < 40; i++) {
    const ch = clean[i]
    out += parseInt(hash[i], 16) >= 8 ? ch.toUpperCase() : ch
  }
  return out
}

export const buildSiweMessage = (params: {
  domain: string
  address: string
  uri: string
  chainId: number
  nonce: string
  statement?: string
  issuedAt?: string
}): string => {
  const checksummed = toChecksumAddress(params.address)
  const statement =
    params.statement ??
    "Sign in with Ethereum to authenticate your wallet with KazeSetu."
  const issuedAt = params.issuedAt ?? new Date().toISOString()

  return [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    checksummed,
    "",
    statement,
    "",
    `URI: ${params.uri}`,
    `Version: 1`,
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n")
}

export const decodeJwtIdentity = (
  accessToken: string | null,
): { address: string; role: Role; exp?: number } | null => {
  if (!accessToken) return null
  try {
    const [, payloadB64] = accessToken.split(".")
    if (!payloadB64) return null
    const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/")
    const json = JSON.parse(atob(normalized)) as {
      sub?: string
      role?: Role
      exp?: number
    }
    if (!json.sub) return null
    return {
      address: json.sub.toLowerCase(),
      role: json.role === "ADMIN" ? "ADMIN" : "USER",
      exp: json.exp,
    }
  } catch {
    return null
  }
}
