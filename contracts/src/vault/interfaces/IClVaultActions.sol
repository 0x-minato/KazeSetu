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
}