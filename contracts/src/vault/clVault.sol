// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../libraries/LiquidityAmounts.sol";
import "../libraries/TickMath.sol";
import "../common/kazeCommon.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IKazeClVault.sol";
import "../errors/Errors.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../common/constants.sol";
import "../interfaces/uniswapV3.sol";

contract KazeClVault is KazeCommon, IKazeClVault, ERC20Upgradeable {
    using SafeCast for uint256;

    INonfungiblePositionManager public manager;
    ISwapRouter public swapRouter;
    IERC20 public token0;
    IERC20 public token1;
    uint24 public fee;

    PositionConfig public position;

    // all values in slot0
    struct PositionConfig {
        address pool; // 20 bytes
        int24 tick_lower; // 3 bytes 
        int24 tick_upper; // 3 bytes 
        uint48 token_id; // 6 bytes
    }

    function initialize(
        address admin,
        string memory name,
        string memory symbol,
        address manager_,
        address swapRouter_,
        address token0_,
        address token1_,
        uint24 fee_,
        address pool_,
        int24 tickLower_,
        int24 tickUpper_
    ) external initializer {
        if (manager_ == address(0) || swapRouter_ == address(0)) revert ZeroAddress();
        if (token0_ == address(0) || token1_ == address(0)) revert ZeroAddress();
        if (token0_ >= token1_) revert InvalidTokens();

        if (pool_ == address(0)) revert ZeroAddress();
        IUniswapV3Pool pool = IUniswapV3Pool(pool_);
        if (pool.token0() != token0_ || pool.token1() != token1_) revert InvalidTokens();
        if (pool.fee() != fee_) revert InvalidFee();

        if (tickLower_ >= tickUpper_) revert InvalidTicks();
        int24 spacing = pool.tickSpacing();
        if (tickLower_ % spacing != 0 || tickUpper_ % spacing != 0) revert InvalidTicks();

        __KazeCommon_init(admin);
        __ERC20_init(name, symbol);

        manager = INonfungiblePositionManager(manager_);
        swapRouter = ISwapRouter(swapRouter_);
        token0 = IERC20(token0_);
        token1 = IERC20(token1_);
        fee = fee_;

        position = PositionConfig({
            pool: pool_,
            tick_lower: tickLower_,
            tick_upper: tickUpper_,
            token_id: 0
        });

        _forceApproveMax();
    }

    function deposit(
        uint256 amount0, 
        uint256 amount1,
        uint256 amountOutMin, 
        address receiver
    ) external override whenNotPaused nonReentrant returns(uint256) {
        if (receiver == address(0)) revert ZeroAddress();
        if (amount0 == 0 && amount1 == 0) revert ZeroAmount();
        (uint256 shares, uint256 amount0Used, uint256 amount1Used) = _process_deposit(amount0, amount1, amountOutMin);
        _mint(receiver, shares);

        emit Deposit(msg.sender, amount0Used, amount1Used, shares, receiver);
        return shares;
    }

    function withdraw(
        uint256 shares,
        address receiver
    ) external override nonReentrant returns(MyPosition memory myPosition) {
        if (receiver == address(0)) revert ZeroAddress();
        if (shares == 0) revert ZeroAmount();
        uint256 userShares = balanceOf(msg.sender);
        if (shares > userShares) revert InvalidShares();

        myPosition = _process_withdraw(shares, receiver);

        emit Withdraw(msg.sender, myPosition.amount0, myPosition.amount1, myPosition.liquidity, receiver);
    }

    function _process_deposit(
        uint256 amount0,
        uint256 amount1,
        uint256 amountOutMin
    ) internal returns(uint256 shares, uint256 amount0Used, uint256 amount1Used
    ) {
        if (amount0 != 0) SafeERC20.safeTransferFrom(token0, msg.sender, address(this), amount0);
        if (amount1 != 0) SafeERC20.safeTransferFrom(token1, msg.sender, address(this), amount1);

        PositionConfig memory position_ = position;
        PoolData memory pool_data = _get_pool_data(position_);
        (uint256 amount0_swap, uint256 amount1_swap) = _compute_swap_amounts(
            pool_data.price,
            amount0,
            amount1,
            pool_data.amount0_total,
            pool_data.amount1_total
        );

        uint256 a0 = amount0;
        uint256 a1 = amount1;
        if(amount0 > amount0_swap) {
            // swap amount0 - amount0_swap
            (a0, a1) = _swap_for_direction(
                amount0,
                amount1,
                amount0_swap,
                amountOutMin,
                pool_data.price,
                true
            );
        } else if(amount1 > amount1_swap) {
            // swap amount1 - amount1_swap
            (a0, a1) = _swap_for_direction(
                amount1,
                amount0,
                amount1_swap,
                amountOutMin,
                pool_data.price,
                false
            );
        }

        uint256 liquidityAdded;
        (liquidityAdded, amount0Used, amount1Used) = _add_liquidity_uniswap(
            uint256(position_.token_id), position_.tick_lower, position_.tick_upper, a0, a1
        ); 

        shares = (pool_data.liquidity == 0) ? liquidityAdded : _convert_to_shares(liquidityAdded, pool_data.liquidity);
    }

    function _process_withdraw(uint256 shares, address receiver) internal returns(
        MyPosition memory myPosition
    ) {
        PositionConfig memory position_ = position;
        PoolData memory pool_data = _get_pool_data(position_);
        // calc liquidity before burning shares for correct calc
        uint128 liquidity = _convert_to_assets(shares, pool_data.liquidity).toUint128();

        // burn shares 
        _burn(msg.sender, shares);

        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
            pool_data.sqrt_price_x96.toUint160(), 
            TickMath.getSqrtRatioAtTick(position_.tick_lower), 
            TickMath.getSqrtRatioAtTick(position_.tick_upper),  
            liquidity
        );

        (uint256 amount0_removed, uint256 amount1_removed) = 
            _remove_liquidity_uniswap(uint256(position_.token_id), liquidity, amount0, amount1, receiver);

        myPosition = MyPosition({
            liquidity: liquidity,
            amount0: amount0_removed,
            amount1: amount1_removed
        });
    }

    function _add_liquidity_uniswap(
        uint256 token_id, int24 tick_lower, int24 tick_upper, uint256 a0, uint256 a1
    ) internal returns(
        uint256 liquidityAdded, uint256 amount0Used, uint256 amount1Used
    ) {
        IERC20 t0 = token0;
        IERC20 t1 = token1;
        INonfungiblePositionManager manager_ = manager;

        if (token_id == 0) {
            uint256 token_id_new;
            (token_id_new, liquidityAdded, amount0Used, amount1Used) = manager_.mint(
                INonfungiblePositionManager.MintParams({
                    token0: address(t0),
                    token1: address(t1),
                    fee: fee,
                    tickLower: tick_lower,
                    tickUpper: tick_upper,
                    amount0Desired: a0,
                    amount1Desired: a1,
                    amount0Min: Math.mulDiv(a0, (BPS_DENOMINATOR - MAX_SLIPPAGE_BPS), BPS_DENOMINATOR),
                    amount1Min: Math.mulDiv(a1, (BPS_DENOMINATOR - MAX_SLIPPAGE_BPS), BPS_DENOMINATOR),
                    recipient: address(this),
                    deadline: block.timestamp
                })
            );
            position.token_id = token_id_new.toUint48();
        } else {
            (liquidityAdded, amount0Used, amount1Used) = manager_.increaseLiquidity(
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: token_id,
                    amount0Desired: a0,
                    amount1Desired: a1,
                    amount0Min: Math.mulDiv(a0, (BPS_DENOMINATOR - MAX_SLIPPAGE_BPS), BPS_DENOMINATOR),
                    amount1Min: Math.mulDiv(a1, (BPS_DENOMINATOR - MAX_SLIPPAGE_BPS), BPS_DENOMINATOR),
                    deadline: block.timestamp
                })
            );
        }

        if (liquidityAdded == 0) revert ZeroLiquidity();

        uint256 bal0_dust = a0 - amount0Used;
        uint256 bal1_dust = a1 - amount1Used;

        if (bal0_dust != 0) SafeERC20.safeTransfer(t0, msg.sender, bal0_dust); 
        if (bal1_dust != 0) SafeERC20.safeTransfer(t1, msg.sender, bal1_dust);
    }

    function _remove_liquidity_uniswap(
        uint256 token_id, uint128 liquidity, uint256 amount0, uint256 amount1, address receiver
    ) internal returns(
        uint256 amount0_removed, uint256 amount1_removed
    ) {
        INonfungiblePositionManager manager_ = manager;

        (uint256 a0, uint256 a1) = manager_.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: token_id,
                liquidity: liquidity,
                amount0Min: Math.mulDiv(amount0, (BPS_DENOMINATOR - MAX_SLIPPAGE_BPS), BPS_DENOMINATOR),
                amount1Min: Math.mulDiv(amount1, (BPS_DENOMINATOR - MAX_SLIPPAGE_BPS), BPS_DENOMINATOR),
                deadline: block.timestamp
            })
        );

        (amount0_removed, amount1_removed) = manager_.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: token_id,
                recipient: receiver,
                amount0Max: a0.toUint128(),
                amount1Max: a1.toUint128()
            })
        );

        if (amount0_removed == 0 && amount1_removed == 0) revert ZeroAmount();
    }

    function _convert_to_assets(
        uint256 shares,
        uint256 total_liquidity
    ) internal view returns(uint256 liquidity) {
        uint256 total_supply = totalSupply();
        liquidity = Math.mulDiv(shares, total_liquidity, total_supply);
        if (liquidity == 0) revert ZeroAmount();
    }

    function _convert_to_shares(
        uint256 liquidity, 
        uint256 total_liquidity
    ) internal view returns(uint256 shares) {
        uint256 total_supply = totalSupply();
        shares = Math.mulDiv(liquidity, total_supply, total_liquidity);
        if (shares == 0) revert ZeroAmount();
    }

    function _get_pool_data(PositionConfig memory position_) internal view returns (PoolData memory pool_data) {
        IUniswapV3Pool pool = IUniswapV3Pool(position_.pool);
        (uint160 sqrt_priceX96,,,,,,) = pool.slot0();

        uint128 liquidity;
        if (position_.token_id != 0) {
            (,,,,,,, liquidity,,,,) =
                manager.positions(position_.token_id);
            if (liquidity == 0 && totalSupply() > 0) revert BrokenInvariant();
        }

        bool empty = position_.token_id == 0 || liquidity == 0;

        (uint256 amount0_total, uint256 amount1_total) = LiquidityAmounts.getAmountsForLiquidity(
            sqrt_priceX96,
            TickMath.getSqrtRatioAtTick(position_.tick_lower),
            TickMath.getSqrtRatioAtTick(position_.tick_upper),
            empty ? PRICE_SCALE.toUint128() : liquidity
        );

        uint256 price = _get_price(sqrt_priceX96);

        pool_data = PoolData({
            sqrt_price_x96: sqrt_priceX96,
            price: price,
            liquidity: empty ? 0 : liquidity,
            amount0_total: amount0_total,
            amount1_total: amount1_total
        });
    }

    function _get_price(uint160 sqrt_priceX96) internal pure returns(uint256 price) {
        price = Math.mulDiv(
            Math.mulDiv(uint256(sqrt_priceX96), sqrt_priceX96, 1 << 96),
            PRICE_SCALE,
            1 << 96
        );
    }

    function _compute_swap_amounts(
        uint256 price, 
        uint256 amount0, 
        uint256 amount1,
        uint256 amount0_total,
        uint256 amount1_total
    ) internal pure returns(
        uint256 amount0_swap, 
        uint256 amount1_swap
    ) {
        // total -> x.p = y
        uint256 v= Math.mulDiv(amount0, price, PRICE_SCALE) + amount1;
        uint256 deno= Math.mulDiv(amount0_total, price, PRICE_SCALE) + amount1_total;

        // x' = total.a / a.p + b
        amount0_swap = Math.mulDiv(v, amount0_total, deno);

        // y' = total.b / a.p + b
        amount1_swap = Math.mulDiv(v, amount1_total, deno);
    }

    function _swap_for_direction(
        uint256 amount, 
        uint256 amount_other,
        uint256 amount_swap,
        uint256 amountOutMin,
        uint256 price,
        bool zero_for_one
    ) internal returns (uint256 a0, uint256 a1){
        IERC20 t0 = token0;
        IERC20 t1 = token1;
        ISwapRouter swapRouter_ = swapRouter;
        uint24 fee_ = fee;
        uint256 amount_in = amount - amount_swap; 
        // adjust fee by div (1 - f)
        amount_in = Math.mulDiv(amount_in, FEE_DENOMINATOR, (FEE_DENOMINATOR - uint256(fee_)));
        if (amount_in > amount) amount_in = amount;
        uint256 expected_out = zero_for_one ? 
            Math.mulDiv(
                amount_in, price, PRICE_SCALE
            ) : Math.mulDiv(
                amount_in, PRICE_SCALE, price
            );
        // adjust fee by mul (1 - f)
        expected_out = Math.mulDiv(expected_out, (FEE_DENOMINATOR - uint256(fee_)), FEE_DENOMINATOR);
        uint256 vault_min = _get_vault_amt_min(expected_out);
        uint256 amount_out_expected = amountOutMin > vault_min ? amountOutMin : vault_min;
        uint256 amount_out = swapRouter_.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: zero_for_one ? address(t0) : address(t1),
                tokenOut: zero_for_one ? address(t1) : address(t0),
                fee: fee_,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amount_in,
                amountOutMinimum: amount_out_expected,
                sqrtPriceLimitX96: 0
            })
        );

        if (zero_for_one) {
            a0 = amount - amount_in;
            a1 = amount_other + amount_out;
        } else { 
            a1 = amount - amount_in;
            a0 = amount_other + amount_out;
        }
    }

    function _get_vault_amt_min(uint256 expected_out) internal pure returns(uint256 vault_min) {
        vault_min = Math.mulDiv(
            expected_out, (BPS_DENOMINATOR - MAX_SLIPPAGE_BPS), BPS_DENOMINATOR
        );
    }

    function _forceApproveMax() internal {
        IERC20 t0 = token0;
        IERC20 t1 = token1;
        address mgr = address(manager);
        address router = address(swapRouter);
        SafeERC20.forceApprove(t0, mgr, type(uint256).max);
        SafeERC20.forceApprove(t1, mgr, type(uint256).max);
        SafeERC20.forceApprove(t0, router, type(uint256).max);
        SafeERC20.forceApprove(t1, router, type(uint256).max);
    }
}
