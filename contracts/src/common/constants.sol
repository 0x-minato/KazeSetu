pragma solidity ^0.8.27;

uint256 constant PRICE_SCALE = 1e18;
uint16 constant MAX_SLIPPAGE_BPS = 100;   // cap, e.g. 1%
uint16 constant BPS_DENOMINATOR = 10_000;
uint256 constant FEE_DENOMINATOR = 1_000_000;