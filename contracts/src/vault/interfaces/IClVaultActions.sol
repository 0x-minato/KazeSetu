// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

interface IClVaultActions {
    function deposit(
        uint256 amount0, 
        uint256 amount1, 
        uint256 amountOutMin,
        address receiver
    ) external returns(uint256);
}