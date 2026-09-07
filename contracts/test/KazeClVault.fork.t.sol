// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {KazeClVault} from "../src/vault/clVault.sol";
import {TickMath} from "../src/libraries/TickMath.sol";
import {INonfungiblePositionManager, ISwapRouter, IUniswapV3Pool, MyPosition} from "../src/interfaces/uniswapV3.sol";
import {InvalidTicks} from "../src/errors/Errors.sol";

interface IWETH is IERC20 {
    function deposit() external payable;
}

/// @dev Mainnet Uniswap V3 USDC/WETH 0.3% pool. Requires ETH_RPC_URL (or Foundry's default mainnet RPC).
contract KazeClVaultForkTest is Test {
    uint24 internal constant FEE = 3000;
    int24 internal constant RANGE_SPACINGS = 3;

    INonfungiblePositionManager internal constant NPM =
        INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);
    ISwapRouter internal constant SWAP_ROUTER = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    IERC20 internal constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IWETH internal constant WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IUniswapV3Pool internal constant POOL = IUniswapV3Pool(0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8);

    KazeClVault internal vault;

    address internal admin = makeAddr("admin");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal trader = makeAddr("trader");

    int24 internal tickLower;
    int24 internal tickUpper;

    function setUp() public {
        string memory rpc = _rpcUrl();
        uint256 forkBlock = vm.envOr("FORK_BLOCK", uint256(0));
        if (forkBlock == 0) {
            vm.createSelectFork(rpc);
        } else {
            vm.createSelectFork(rpc, forkBlock);
        }

        int24 spacing = POOL.tickSpacing();
        (tickLower, tickUpper) = _rangeAroundSpot(RANGE_SPACINGS, spacing);

        KazeClVault implementation = new KazeClVault();
        bytes memory initData = abi.encodeCall(
            KazeClVault.initialize,
            (
                admin,
                "Kaze CL",
                "kCL",
                address(NPM),
                address(SWAP_ROUTER),
                address(USDC),
                address(WETH),
                FEE,
                address(POOL),
                tickLower,
                tickUpper
            )
        );
        vault = KazeClVault(address(new ERC1967Proxy(address(implementation), initData)));

        vm.label(address(vault), "vault");
        vm.label(address(USDC), "USDC");
        vm.label(address(WETH), "WETH");
        vm.label(address(POOL), "USDC/WETH 0.3%");
    }

    function testFork_firstDeposit_mintsSharesAndNft() public {
        _fund(alice, 50_000e6, 20 ether);

        vm.prank(alice);
        uint256 shares = vault.deposit(50_000e6, 20 ether, 0, alice);

        assertGt(shares, 0);
        assertEq(vault.balanceOf(alice), shares);
        assertEq(vault.totalSupply(), shares);
        (,,, uint48 tokenId) = vault.position();
        assertGt(tokenId, 0);
        assertGt(_nftLiquidity(tokenId), 0);
    }

    function testFork_secondDeposit_mintsProRataShares() public {
        _fund(alice, 50_000e6, 20 ether);
        _fund(bob, 50_000e6, 20 ether);

        vm.prank(alice);
        uint256 aliceShares = vault.deposit(50_000e6, 20 ether, 0, alice);

        vm.prank(bob);
        uint256 bobShares = vault.deposit(50_000e6, 20 ether, 0, bob);

        assertGt(bobShares, 0);
        assertApproxEqRel(bobShares, aliceShares, 0.05e18);
        assertEq(vault.totalSupply(), aliceShares + bobShares);
    }

    function testFork_unbalancedDeposit_zapsAndRefundsDust() public {
        uint256 usdcIn = 50_000e6;
        uint256 wethIn = 18 ether;
        _fund(alice, usdcIn, wethIn);

        uint256 usdcBefore = USDC.balanceOf(alice);
        uint256 wethBefore = WETH.balanceOf(alice);

        vm.prank(alice);
        uint256 shares = vault.deposit(usdcIn, wethIn, 0, alice);

        assertGt(shares, 0);
        assertLt(USDC.balanceOf(alice) + WETH.balanceOf(alice), usdcBefore + wethBefore);
        (,,, uint48 tokenId) = vault.position();
        assertGt(_nftLiquidity(tokenId), 0);
    }

    function testFork_withdraw_returnsTokensAndBurnsShares() public {
        _fund(alice, 50_000e6, 20 ether);
        vm.prank(alice);
        uint256 shares = vault.deposit(50_000e6, 20 ether, 0, alice);

        uint256 usdcBefore = USDC.balanceOf(alice);
        uint256 wethBefore = WETH.balanceOf(alice);

        vm.prank(alice);
        MyPosition memory pos = vault.withdraw(shares, alice);

        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.totalSupply(), 0);
        assertGt(pos.liquidity, 0);
        assertTrue(pos.amount0 > 0 || pos.amount1 > 0);
        assertEq(USDC.balanceOf(alice), usdcBefore + pos.amount0);
        assertEq(WETH.balanceOf(alice), wethBefore + pos.amount1);
    }

    function testFork_partialWithdraw_leavesRemainingShares() public {
        _fund(alice, 50_000e6, 20 ether);
        vm.prank(alice);
        uint256 shares = vault.deposit(50_000e6, 20 ether, 0, alice);

        uint256 half = shares / 2;
        vm.prank(alice);
        MyPosition memory pos = vault.withdraw(half, alice);

        assertEq(vault.balanceOf(alice), shares - half);
        assertTrue(pos.amount0 > 0 || pos.amount1 > 0);

        vm.prank(alice);
        vault.withdraw(shares - half, alice);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.totalSupply(), 0);
    }

    function testFork_withdraw_toOtherReceiver() public {
        _fund(alice, 50_000e6, 20 ether);
        vm.prank(alice);
        uint256 shares = vault.deposit(50_000e6, 20 ether, 0, alice);

        uint256 usdcBefore = USDC.balanceOf(bob);
        vm.prank(alice);
        MyPosition memory pos = vault.withdraw(shares, bob);

        assertEq(vault.balanceOf(alice), 0);
        assertEq(USDC.balanceOf(bob), usdcBefore + pos.amount0);
        assertGt(WETH.balanceOf(bob), 0);
    }

    function testFork_twoUsers_independentWithdraw() public {
        _fund(alice, 50_000e6, 20 ether);
        vm.prank(alice);
        uint256 aliceShares = vault.deposit(50_000e6, 20 ether, 0, alice);
        vm.prank(alice);
        MyPosition memory alicePos = vault.withdraw(aliceShares, alice);

        _fund(bob, 50_000e6, 20 ether);
        vm.prank(bob);
        uint256 bobShares = vault.deposit(50_000e6, 20 ether, 0, bob);
        vm.prank(bob);
        MyPosition memory bobPos = vault.withdraw(bobShares, bob);

        assertEq(vault.totalSupply(), 0);
        assertTrue(alicePos.amount0 > 0 || alicePos.amount1 > 0);
        assertTrue(bobPos.amount0 > 0 || bobPos.amount1 > 0);
        assertApproxEqRel(alicePos.liquidity, bobPos.liquidity, 0.05e18);
    }

    function testFork_handleFees_afterVolumeDoesNotReduceLiquidity() public {
        _fund(alice, 100_000e6, 40 ether);
        vm.prank(alice);
        vault.deposit(100_000e6, 40 ether, 0, alice);

        (,,, uint48 tokenId) = vault.position();
        uint128 liqBefore = _nftLiquidity(tokenId);

        _roundTripSwap(500_000e6);

        vault.handle_fees();

        assertGe(_nftLiquidity(tokenId), liqBefore);
        assertEq(vault.totalSupply(), vault.balanceOf(alice));
    }

    function testFork_rebalance_revertsWhenInRange() public {
        _fund(alice, 50_000e6, 20 ether);
        vm.prank(alice);
        vault.deposit(50_000e6, 20 ether, 0, alice);

        int24 spacing = POOL.tickSpacing();
        (int24 newLower, int24 newUpper) = _rangeAroundSpot(20, spacing);

        vm.prank(admin);
        vm.expectRevert(InvalidTicks.selector);
        vault.rebalance(newLower, newUpper, 0);
    }

    function testFork_rebalance_movesRangeWhenOutOfRange() public {
        _fund(alice, 5_000e6, 2 ether);
        vm.prank(alice);
        vault.deposit(5_000e6, 2 ether, 0, alice);
        uint256 supplyBefore = vault.totalSupply();
        (,,, uint48 tokenIdBefore) = vault.position();

        _pushPriceAboveRange();

        int24 spacing = POOL.tickSpacing();
        (int24 newLower, int24 newUpper) = _rangeAroundSpot(20, spacing);

        vm.prank(admin);
        (uint256 newLiquidity, uint256 amount0Used, uint256 amount1Used) = vault.rebalance(newLower, newUpper, 0);

        assertGt(newLiquidity, 0);
        assertTrue(amount0Used > 0 || amount1Used > 0);
        assertEq(vault.totalSupply(), supplyBefore);

        (, int24 lower, int24 upper, uint48 tokenIdAfter) = vault.position();
        assertEq(lower, newLower);
        assertEq(upper, newUpper);
        assertGt(tokenIdAfter, 0);
        assertTrue(tokenIdAfter != tokenIdBefore);
        assertEq(_nftLiquidity(tokenIdAfter), newLiquidity);
    }

    function testFork_withdraw_afterRebalance() public {
        _fund(alice, 5_000e6, 2 ether);
        vm.prank(alice);
        uint256 shares = vault.deposit(5_000e6, 2 ether, 0, alice);

        _pushPriceAboveRange();

        int24 spacing = POOL.tickSpacing();
        (int24 newLower, int24 newUpper) = _rangeAroundSpot(20, spacing);
        vm.prank(admin);
        vault.rebalance(newLower, newUpper, 0);

        uint256 usdcBefore = USDC.balanceOf(alice);
        uint256 wethBefore = WETH.balanceOf(alice);

        vm.prank(alice);
        MyPosition memory pos = vault.withdraw(shares, alice);

        assertEq(vault.balanceOf(alice), 0);
        assertTrue(pos.amount0 > 0 || pos.amount1 > 0);
        assertEq(USDC.balanceOf(alice), usdcBefore + pos.amount0);
        assertEq(WETH.balanceOf(alice), wethBefore + pos.amount1);
    }

    function _rpcUrl() internal view returns (string memory) {
        try vm.envString("ETH_RPC_URL") returns (string memory url) {
            if (bytes(url).length != 0) return url;
        } catch {}
        return "https://ethereum.publicnode.com";
    }

    function _fund(address user, uint256 usdcAmount, uint256 wethAmount) internal {
        if (wethAmount != 0) {
            deal(user, wethAmount + 1 ether);
            vm.startPrank(user);
            WETH.deposit{value: wethAmount}();
            WETH.approve(address(vault), type(uint256).max);
            WETH.approve(address(SWAP_ROUTER), type(uint256).max);
            vm.stopPrank();
        }
        if (usdcAmount != 0) {
            deal(address(USDC), user, usdcAmount, true);
            vm.startPrank(user);
            USDC.approve(address(vault), type(uint256).max);
            USDC.approve(address(SWAP_ROUTER), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _rangeAroundSpot(int24 widthSpacings, int24 spacing) internal view returns (int24 lower, int24 upper) {
        (uint160 sqrtPriceX96,,,,,,) = POOL.slot0();
        int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);
        int24 floor = _floorToSpacing(tick, spacing);
        lower = floor - widthSpacings * spacing;
        upper = floor + widthSpacings * spacing;
    }

    function _floorToSpacing(int24 tick, int24 spacing) internal pure returns (int24) {
        int24 compressed = tick / spacing;
        if (tick < 0 && tick % spacing != 0) compressed--;
        return compressed * spacing;
    }

    function _nftLiquidity(uint48 tokenId) internal view returns (uint128 liquidity) {
        (,,,,,,, liquidity,,,,) = NPM.positions(uint256(tokenId));
    }

    function _roundTripSwap(uint256 usdcIn) internal {
        _fund(trader, usdcIn, 0);
        vm.startPrank(trader);
        uint256 wethOut = SWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(USDC),
                tokenOut: address(WETH),
                fee: FEE,
                recipient: trader,
                deadline: block.timestamp,
                amountIn: usdcIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        WETH.approve(address(SWAP_ROUTER), wethOut);
        SWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(WETH),
                tokenOut: address(USDC),
                fee: FEE,
                recipient: trader,
                deadline: block.timestamp,
                amountIn: wethOut,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        vm.stopPrank();
    }

    function _pushPriceAboveRange() internal {
        _fund(trader, 0, 2_000 ether);
        uint256 chunk = 20 ether;
        vm.startPrank(trader);
        for (uint256 i = 0; i < 12; ++i) {
            (uint160 sqrtPrice,,,,,,) = POOL.slot0();
            if (TickMath.getTickAtSqrtRatio(sqrtPrice) >= tickUpper) break;
            uint256 amountIn = chunk;
            uint256 bal = WETH.balanceOf(trader);
            if (amountIn > bal) amountIn = bal;
            require(amountIn != 0, "fork: cannot push price");
            SWAP_ROUTER.exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: address(WETH),
                    tokenOut: address(USDC),
                    fee: FEE,
                    recipient: trader,
                    deadline: block.timestamp,
                    amountIn: amountIn,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );
            chunk *= 2;
        }
        vm.stopPrank();

        (uint160 sqrtPriceX96,,,,,,) = POOL.slot0();
        require(TickMath.getTickAtSqrtRatio(sqrtPriceX96) >= tickUpper, "fork: price still in range");
    }
}
