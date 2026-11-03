# Smart Contracts Documentation (`contracts/`)

## Overview

The `contracts/` workspace contains the Solidity smart contracts for **KazeSetu**, built with **Foundry** (`solc 0.8.27`, `via_ir = true`, OpenZeppelin v5 Upgradeable).

At the core of the protocol is **`KazeClVault`** (`contracts/src/vault/clVault.sol`), a **Concentrated Liquidity (CL) Automated Vault** built on top of **Uniswap V3** (`IUniswapV3Pool`, `INonfungiblePositionManager`, `ISwapRouter`). It wraps a single active Uniswap V3 concentrated liquidity NFT position (`[tick_lower, tick_upper]`) into fungible **ERC-20 vault shares**, automating:

1. **Single-sided or unbalanced deposits** (automatic zap via `ISwapRouter.exactInputSingle` to match the active tick range's optimal token ratio).
2. **Pro-rata share minting and burning** (`ERC20Upgradeable`).
3. **Auto-compounding of trading fees** (`handle_fees()` collects Uniswap V3 fees and reinvests them back into active liquidity).
4. **Governor-controlled range rebalancing** (`rebalance()` withdraws liquidity when the spot tick moves out of range and re-mints into a new `[new_lower_tick, new_upper_tick]` range).

---

## Directory Structure

```text
contracts/
├── foundry.toml                           # Solc 0.8.27, via_ir, optimizer (200 runs)
├── src/
│   ├── common/
│   │   ├── constants.sol                  # PRICE_SCALE (1e18), MAX_SLIPPAGE_BPS (100), BPS_DENOMINATOR (10_000), FEE_DENOMINATOR (1_000_000)
│   │   └── kazeCommon.sol                 # UUPS + AccessControl + Pausable + ReentrancyGuardTransient base
│   ├── errors/
│   │   └── Errors.sol                     # Custom errors (ZeroAddress, ZeroAmount, InvalidTicks, InvalidTokens, InvalidFee, InvalidShares, BrokenInvariant, etc.)
│   ├── interfaces/
│   │   └── uniswapV3.sol                  # IUniswapV3Pool, INonfungiblePositionManager, ISwapRouter, PoolData, MyPosition
│   ├── libraries/
│   │   ├── FixedPoint96.sol               # Q96 fixed-point constants
│   │   ├── FullMath.sol                   # 512-bit mulDiv precision math
│   │   ├── LiquidityAmounts.sol           # Uniswap V3 liquidity <-> token amount conversions
│   │   └── TickMath.sol                   # Tick <-> sqrtPriceX96 conversions
│   └── vault/
│       ├── clVault.sol                    # KazeClVault core implementation
│       └── interfaces/
│           ├── IClVaultActions.sol        # External write/view interface
│           ├── IClVaultEvents.sol         # Deposit, Withdraw, HandleFees, Rebalance events
│           └── IKazeClVault.sol           # Combined vault interface
├── script/
│   └── DeployKazeClVault.s.sol            # ERC1967Proxy + KazeClVault deployment script
└── test/
    ├── KazeClVault.t.sol                  # Unit test suite with MockPool, MockNpm, MockSwapRouter
    └── KazeClVault.fork.t.sol             # Mainnet fork test suite against live Uniswap V3 USDC/WETH 0.3%
```

---

## Contract Architecture

### 1. `KazeCommon` (`src/common/kazeCommon.sol`)
Abstract base contract inherited by `KazeClVault`:
- **Upgradeability**: OpenZeppelin `UUPSUpgradeable` (`_authorizeUpgrade` restricted to `DEFAULT_ADMIN_ROLE`).
- **Role-Based Access Control**: `AccessControlUpgradeable` with:
  - `DEFAULT_ADMIN_ROLE`: Can authorize UUPS contract upgrades and manage roles.
  - `GOVERNOR_ROLE`: Can call `rebalance()`, `pause()`, and `unpause()`.
  - `RELAYER_ROLE`: Reserved for automated keeper operations.
- **Transient Reentrancy Protection**: Uses EIP-1153 `ReentrancyGuardTransient` for gas-efficient reentrancy locks.
- **Emergency Pause**: `PausableUpgradeable` (`deposit`, `handle_fees`, and `rebalance` require `whenNotPaused`; **`withdraw` remains enabled even when paused** so users can always exit).

### 2. Storage Packing (`PositionConfig`)
`KazeClVault` packs the active Uniswap V3 position metadata into a single 32-byte storage slot:
```solidity
struct PositionConfig {
    address pool;     // 20 bytes — Uniswap V3 Pool address
    int24 tick_lower; // 3 bytes  — Active lower tick boundary
    int24 tick_upper; // 3 bytes  — Active upper tick boundary
    uint48 token_id;  // 6 bytes  — Uniswap V3 NonfungiblePositionManager NFT ID (0 before first deposit)
}
```

---

## Core Protocol Flows & Math

### 1. Deposit & Auto-Zap (`deposit`)
```solidity
function deposit(
    uint256 amount0,
    uint256 amount1,
    uint256 amountOutMin,
    address receiver
) external whenNotPaused nonReentrant returns (uint256 shares)
```
1. **Fee Compounding First**: Calls `_handle_fees()` so accrued fees are compounded into the vault's existing liquidity before calculating the new depositor's share ratio.
2. **Token Pull**: Transfers `amount0` of `token0` and `amount1` of `token1` from `msg.sender`.
3. **Optimal Zap Calculation (`_compute_swap_amounts`)**:
   - Queries `pool.slot0()` for `sqrtPriceX96` and computes spot price $P = \frac{(\text{sqrtPriceX96})^2 \cdot 10^{18}}{2^{192}}$.
   - Computes target ratio `(amount0_total, amount1_total)` required by the active tick range `[tick_lower, tick_upper]`.
   - Calculates exact swap amounts so the post-swap token balances match the tick range ratio:
     $$v = \text{amount0} \cdot P + \text{amount1}, \quad D = \text{amount0\_total} \cdot P + \text{amount1\_total}$$
     $$\text{amount0\_swap} = \frac{v \cdot \text{amount0\_total}}{D}, \quad \text{amount1\_swap} = \frac{v \cdot \text{amount1\_total}}{D}$$
4. **Swap Execution (`_swap_for_direction`)**:
   - Swaps excess `token0` or `token1` via `swapRouter.exactInputSingle` with slippage protection (`MAX_SLIPPAGE_BPS = 100` = 1% cap or user's `amountOutMin`, whichever is stricter).
5. **Uniswap V3 Liquidity Addition (`_add_liquidity_uniswap`)**:
   - On the first deposit (`token_id == 0`), calls `manager.mint(...)` and stores the new `token_id`.
   - On subsequent deposits, calls `manager.increaseLiquidity(...)`.
   - Refunds any unspent token dust (`a0 - amount0Used`, `a1 - amount1Used`) directly back to `msg.sender`.
6. **Share Minting**:
   - First deposit (`pool_data.liquidity == 0`): $\text{shares} = \text{liquidityAdded}$.
   - Subsequent deposits:
     $$\text{shares} = \left\lfloor \frac{\text{liquidityAdded} \times \text{totalSupply}}{\text{existingLiquidity}} \right\rfloor$$
   - Emits `Deposit(msg.sender, amount0Used, amount1Used, shares, receiver)`.

### 2. Withdraw (`withdraw`)
```solidity
function withdraw(
    uint256 shares,
    address receiver
) external nonReentrant returns (MyPosition memory myPosition)
```
1. Calls `_handle_fees()` to compound any pending fees prior to withdrawal.
2. Computes the user's proportional Uniswap V3 liquidity:
   $$\text{liquidity} = \left\lfloor \frac{\text{shares} \times \text{totalLiquidity}}{\text{totalSupply}} \right\rfloor$$
3. Burns `shares` from `msg.sender`.
4. Calls `manager.decreaseLiquidity(...)` and `manager.collect(...)` sending `amount0_removed` and `amount1_removed` directly to `receiver`.
5. Emits `Withdraw(msg.sender, amount0_removed, amount1_removed, liquidity, receiver)`.

### 3. Auto-Compounding Fees (`handle_fees`)
```solidity
function handle_fees() external whenNotPaused nonReentrant
```
- Collects all accrued `tokensOwed0` and `tokensOwed1` from `INonfungiblePositionManager.collect` (`amount0Max = type(uint128).max`, `amount1Max = type(uint128).max`).
- Zaps and adds the collected fees back into the active Uniswap V3 NFT position via `_rebalance_and_add`, increasing the underlying liquidity backing every vault share.
- Emits `HandleFees(liquidityAdded, amount0_used, amount1_used)`.

### 4. Out-of-Range Rebalance (`rebalance`)
```solidity
function rebalance(
    int24 new_lower_tick,
    int24 new_upper_tick,
    uint256 amount_out_min
) external whenNotPaused nonReentrant onlyRole(GOVERNOR_ROLE)
```
- **Guardrails**:
  - Reverts with `InvalidTicks()` if the current pool tick is still inside `[tick_lower, tick_upper)` (rebalancing is only permitted when the position is out of range).
  - Reverts with `InvalidTicks()` if the current pool tick is not inside the new range `[new_lower_tick, new_upper_tick)` or if the new ticks are not multiples of `pool.tickSpacing()`.
- **Execution**:
  - Withdraws 100% of liquidity from the old NFT position (`_remove_liquidity_uniswap` with `isRebalance = true`).
  - Updates `position.tick_lower = new_lower_tick`, `position.tick_upper = new_upper_tick`, and resets `token_id = 0`.
  - Zaps the withdrawn tokens into the optimal ratio for the new range and mints a new Uniswap V3 NFT position.
  - Emits `Rebalance(old_lower_tick, old_upper_tick, new_lower_tick, new_upper_tick, new_liquidity, amount0_used, amount1_used)`.

---

## Building, Testing & Deploying

### Build Contracts
```bash
cd contracts
forge build
```

### Run Unit Tests
```bash
cd contracts
forge test --match-path test/KazeClVault.t.sol -vvv
```

### Run Mainnet Fork Tests
```bash
cd contracts
ETH_RPC_URL=https://ethereum-rpc.publicnode.com forge test --match-path test/KazeClVault.fork.t.sol -vvv
```

### Deploy `KazeClVault` (UUPS Proxy)
```bash
cd contracts
forge script script/DeployKazeClVault.s.sol:DeployKazeClVault \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```
