// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import "../../interfaces/uniswapV3.sol";

interface IClVaultActions {
    function deposit(
        uint256 amount0, 
        uint256 amount1, 
        uint256 amountOutMin,
        address receiver
    ) external returns(uint256);

    function withdraw(
        uint256 shares,
        address receiver
    ) external returns(MyPosition memory);

    function convert_to_assets(uint256 shares, uint256 total_liquidity) external view returns(uint256 liquidity);
    function convert_to_shares(uint256 liquidity, uint256 total_liquidity) external view returns(uint256 shares);
    function handle_fees() external;
    function rebalance(
        int24 new_lower_tick, 
        int24 new_upper_tick, 
        uint256 amount_out_min
    ) external returns(
        uint256 new_liquidity,
        uint256 amount0_used,
        uint256 amount1_used
    );
}