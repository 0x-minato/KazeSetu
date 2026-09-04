// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

interface IClVaultEvents {
    event Deposit(address sender, uint256 amount0Used, uint256 amount1Used, uint256 shares, address receiver);
    event Withdraw(address sender, uint256 amount0Withdraw, uint256 amount1Withdraw, uint256 liquidity, address receiver);
}


