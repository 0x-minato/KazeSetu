// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

interface IClVaultEvents {
    event Deposit(address sender, uint256 amount0Used, uint256 amount1Used, uint256 shares, address receiver);
    event Withdraw(address sender, uint256 amount0Withdraw, uint256 amount1Withdraw, uint256 liquidity, address receiver);
    event HandleFees(uint256 liquidityAdded, uint256 amount0Used, uint256 amount1Used);
    event Rebalance(
        int24 old_lower_tick, 
        int24 old_upper_tick, 
        int24 new_lower_tick, 
        int24 new_upper_tick, 
        uint256 new_liquidity,
        uint256 amount0_used,
        uint256 amount1_used
    );
}


