// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

interface IClVaultEvents {
    event Deposit(address sender, uint256 amount0Used, uint256 amount1Used, uint256 shares, address receiver);
}


