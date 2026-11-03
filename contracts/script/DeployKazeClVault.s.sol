// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {KazeClVault} from "../src/vault/clVault.sol";
import {IUniswapV3Pool} from "../src/interfaces/uniswapV3.sol";
import {TickMath} from "../src/libraries/TickMath.sol";

/// @notice Deploys the KazeClVault UUPS implementation and ERC1967Proxy.
/// @dev Usage:
///   forge script script/DeployKazeClVault.s.sol:DeployKazeClVault --rpc-url $RPC_URL --broadcast
contract DeployKazeClVault is Script {
    // Default Mainnet / Anvil Fork addresses (Uniswap V3 USDC/WETH 0.3%)
    address internal constant DEFAULT_NPM = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    address internal constant DEFAULT_SWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address internal constant DEFAULT_USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant DEFAULT_WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant DEFAULT_POOL = 0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8;
    uint24 internal constant DEFAULT_FEE = 3000;

    function run() external returns (KazeClVault vault, KazeClVault implementation) {
        address admin = vm.envOr("ADMIN_ADDRESS", msg.sender);
        string memory name = vm.envOr("VAULT_NAME", string("Kaze USDC-WETH CL Vault"));
        string memory symbol = vm.envOr("VAULT_SYMBOL", string("kCL-USDC-WETH"));
        address manager = vm.envOr("UNISWAP_V3_NPM", DEFAULT_NPM);
        address swapRouter = vm.envOr("UNISWAP_V3_ROUTER", DEFAULT_SWAP_ROUTER);
        address token0 = vm.envOr("VAULT_TOKEN0", DEFAULT_USDC);
        address token1 = vm.envOr("VAULT_TOKEN1", DEFAULT_WETH);
        uint24 fee = uint24(vm.envOr("VAULT_FEE", uint256(DEFAULT_FEE)));
        address pool = vm.envOr("VAULT_POOL", DEFAULT_POOL);

        (int24 tickLower, int24 tickUpper) = _resolveTicks(pool);

        vm.startBroadcast();

        implementation = new KazeClVault();
        bytes memory initData = abi.encodeCall(
            KazeClVault.initialize,
            (
                admin,
                name,
                symbol,
                manager,
                swapRouter,
                token0,
                token1,
                fee,
                pool,
                tickLower,
                tickUpper
            )
        );

        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        vault = KazeClVault(address(proxy));

        vm.stopBroadcast();

        console2.log("KazeClVault Implementation:", address(implementation));
        console2.log("KazeClVault Proxy:         ", address(vault));
        console2.log("Pool:                      ", pool);
        console2.log("Tick Lower:                ", tickLower);
        console2.log("Tick Upper:                ", tickUpper);
    }

    function _resolveTicks(address poolAddr) internal view returns (int24 lower, int24 upper) {
        int256 envLower = vm.envOr("VAULT_TICK_LOWER", int256(0));
        int256 envUpper = vm.envOr("VAULT_TICK_UPPER", int256(0));
        if (envLower < envUpper) {
            return (int24(envLower), int24(envUpper));
        }

        IUniswapV3Pool pool = IUniswapV3Pool(poolAddr);
        (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
        int24 spacing = pool.tickSpacing();
        int24 spotTick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);
        int24 compressed = spotTick / spacing;
        if (spotTick < 0 && spotTick % spacing != 0) compressed--;
        int24 floorTick = compressed * spacing;

        lower = floorTick - (10 * spacing);
        upper = floorTick + (10 * spacing);
    }
}
