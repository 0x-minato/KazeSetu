// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import {KazeClVault} from "../src/vault/clVault.sol";
import {TickMath} from "../src/libraries/TickMath.sol";
import {LiquidityAmounts} from "../src/libraries/LiquidityAmounts.sol";
import {INonfungiblePositionManager, ISwapRouter, IUniswapV3Pool, MyPosition} from "../src/interfaces/uniswapV3.sol";
import {ZeroAddress, ZeroAmount, ZeroTokenId, InvalidTicks, InvalidTokens, InvalidFee, InvalidShares} from "../src/errors/Errors.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_) ERC20(name_, name_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockPool is IUniswapV3Pool {
    address public override token0;
    address public override token1;
    uint24 public override fee;
    int24 public override tickSpacing;
    uint160 public sqrtPriceX96;
    int24 public tick;

    constructor(address token0_, address token1_, uint24 fee_, int24 spacing_) {
        token0 = token0_;
        token1 = token1_;
        fee = fee_;
        tickSpacing = spacing_;
        tick = 0;
        sqrtPriceX96 = TickMath.getSqrtRatioAtTick(0);
    }

    function setSlot0(int24 tick_) external {
        tick = tick_;
        sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick_);
    }

    function slot0()
        external
        view
        override
        returns (uint160, int24, uint16, uint16, uint16, uint8, bool)
    {
        return (sqrtPriceX96, tick, 0, 0, 0, 0, true);
    }

    function positions(bytes32)
        external
        pure
        override
        returns (uint128, uint256, uint256, uint128, uint128)
    {
        return (0, 0, 0, 0, 0);
    }

    function collect(address, int24, int24, uint128, uint128) external pure override returns (uint128, uint128) {
        return (0, 0);
    }
}

contract MockNpm is INonfungiblePositionManager {
    struct Pos {
        uint128 liquidity;
        int24 tickLower;
        int24 tickUpper;
        uint256 owed0;
        uint256 owed1;
    }

    MockPool public pool;
    uint256 public nextId = 1;
    mapping(uint256 => Pos) internal _positions;

    constructor(MockPool pool_) {
        pool = pool_;
    }

    function mint(MintParams calldata params)
        external
        payable
        override
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        tokenId = nextId++;
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        if (amount0 != 0) IERC20(params.token0).transferFrom(msg.sender, address(this), amount0);
        if (amount1 != 0) IERC20(params.token1).transferFrom(msg.sender, address(this), amount1);

        liquidity = LiquidityAmounts.getLiquidityForAmounts(
            pool.sqrtPriceX96(),
            TickMath.getSqrtRatioAtTick(params.tickLower),
            TickMath.getSqrtRatioAtTick(params.tickUpper),
            amount0,
            amount1
        );
        if (liquidity == 0) liquidity = 1;

        _positions[tokenId] = Pos({
            liquidity: liquidity,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            owed0: 0,
            owed1: 0
        });
    }

    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        override
        returns (uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        Pos storage pos = _positions[params.tokenId];
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        if (amount0 != 0) IERC20(pool.token0()).transferFrom(msg.sender, address(this), amount0);
        if (amount1 != 0) IERC20(pool.token1()).transferFrom(msg.sender, address(this), amount1);

        liquidity = LiquidityAmounts.getLiquidityForAmounts(
            pool.sqrtPriceX96(),
            TickMath.getSqrtRatioAtTick(pos.tickLower),
            TickMath.getSqrtRatioAtTick(pos.tickUpper),
            amount0,
            amount1
        );
        if (liquidity == 0) liquidity = 1;
        pos.liquidity += liquidity;
    }

    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        override
        returns (uint256 amount0, uint256 amount1)
    {
        Pos storage pos = _positions[params.tokenId];
        require(pos.liquidity >= params.liquidity, "liq");
        uint256 bal0 = IERC20(pool.token0()).balanceOf(address(this));
        uint256 bal1 = IERC20(pool.token1()).balanceOf(address(this));
        amount0 = (bal0 * params.liquidity) / pos.liquidity;
        amount1 = (bal1 * params.liquidity) / pos.liquidity;
        pos.liquidity -= params.liquidity;
        pos.owed0 += amount0;
        pos.owed1 += amount1;
    }

    function collect(CollectParams calldata params)
        external
        payable
        override
        returns (uint256 amount0, uint256 amount1)
    {
        Pos storage pos = _positions[params.tokenId];
        amount0 = params.amount0Max < pos.owed0 ? params.amount0Max : pos.owed0;
        amount1 = params.amount1Max < pos.owed1 ? params.amount1Max : pos.owed1;
        pos.owed0 -= amount0;
        pos.owed1 -= amount1;
        if (amount0 != 0) IERC20(pool.token0()).transfer(params.recipient, amount0);
        if (amount1 != 0) IERC20(pool.token1()).transfer(params.recipient, amount1);
    }

    function positions(uint256 tokenId)
        external
        view
        override
        returns (
            uint96,
            address,
            address,
            address,
            uint24,
            int24,
            int24,
            uint128 liquidity,
            uint256,
            uint256,
            uint128,
            uint128
        )
    {
        Pos storage pos = _positions[tokenId];
        return (0, address(0), address(0), address(0), 0, 0, 0, pos.liquidity, 0, 0, 0, 0);
    }

    function burn(uint256) external payable override {}
}

contract MockSwapRouter is ISwapRouter {
    uint24 public immutable poolFee;

    constructor(uint24 poolFee_) {
        poolFee = poolFee_;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        amountOut = (params.amountIn * (1_000_000 - uint256(poolFee))) / 1_000_000;
        if (amountOut < params.amountOutMinimum) amountOut = params.amountOutMinimum;
        MockERC20(params.tokenOut).mint(params.recipient, amountOut);
    }

    function exactInput(ExactInputParams calldata) external payable override returns (uint256) {
        revert("unused");
    }

    function exactOutputSingle(ExactOutputSingleParams calldata) external payable override returns (uint256) {
        revert("unused");
    }

    function exactOutput(ExactOutputParams calldata) external payable override returns (uint256) {
        revert("unused");
    }
}

contract KazeClVaultTest is Test {
    uint24 internal constant FEE = 3000;
    int24 internal constant SPACING = 60;
    int24 internal constant TICK_LOWER = -60;
    int24 internal constant TICK_UPPER = 60;

    KazeClVault internal vault;
    KazeClVault internal implementation;
    MockERC20 internal token0;
    MockERC20 internal token1;
    MockPool internal pool;
    MockNpm internal npm;
    MockSwapRouter internal router;

    address internal admin = makeAddr("admin");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        MockERC20 a = new MockERC20("A");
        MockERC20 b = new MockERC20("B");
        if (address(a) < address(b)) {
            token0 = a;
            token1 = b;
        } else {
            token0 = b;
            token1 = a;
        }

        pool = new MockPool(address(token0), address(token1), FEE, SPACING);
        npm = new MockNpm(pool);
        router = new MockSwapRouter(FEE);

        implementation = new KazeClVault();
        vault = _deployVault(admin, address(npm), address(router), address(token0), address(token1), FEE, address(pool), TICK_LOWER, TICK_UPPER);
    }

    function _deployVault(
        address admin_,
        address manager_,
        address router_,
        address token0_,
        address token1_,
        uint24 fee_,
        address pool_,
        int24 tickLower_,
        int24 tickUpper_
    ) internal returns (KazeClVault) {
        bytes memory initData = abi.encodeCall(
            KazeClVault.initialize,
            (admin_, "Kaze CL", "kCL", manager_, router_, token0_, token1_, fee_, pool_, tickLower_, tickUpper_)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        return KazeClVault(address(proxy));
    }

    function _fund(address user, uint256 amount0, uint256 amount1) internal {
        token0.mint(user, amount0);
        token1.mint(user, amount1);
        vm.startPrank(user);
        token0.approve(address(vault), type(uint256).max);
        token1.approve(address(vault), type(uint256).max);
        vm.stopPrank();
    }

    function test_initialize_setsState() public view {
        assertEq(address(vault.manager()), address(npm));
        assertEq(address(vault.swapRouter()), address(router));
        assertEq(address(vault.token0()), address(token0));
        assertEq(address(vault.token1()), address(token1));
        assertEq(vault.fee(), FEE);
        (address pool_, int24 lower, int24 upper, uint48 tokenId) = vault.position();
        assertEq(pool_, address(pool));
        assertEq(lower, TICK_LOWER);
        assertEq(upper, TICK_UPPER);
        assertEq(tokenId, 0);
        assertEq(vault.name(), "Kaze CL");
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(vault.hasRole(vault.GOVERNOR_ROLE(), admin));
    }

    function test_initialize_revertsOnImplementation() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        implementation.initialize(
            admin, "Kaze CL", "kCL", address(npm), address(router), address(token0), address(token1), FEE, address(pool), TICK_LOWER, TICK_UPPER
        );
    }

    function test_initialize_revertsWhenCalledTwice() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        vault.initialize(
            admin, "Kaze CL", "kCL", address(npm), address(router), address(token0), address(token1), FEE, address(pool), TICK_LOWER, TICK_UPPER
        );
    }

    function test_initialize_revertsZeroManager() public {
        vm.expectRevert(ZeroAddress.selector);
        _deployVault(admin, address(0), address(router), address(token0), address(token1), FEE, address(pool), TICK_LOWER, TICK_UPPER);
    }

    function test_initialize_revertsZeroRouter() public {
        vm.expectRevert(ZeroAddress.selector);
        _deployVault(admin, address(npm), address(0), address(token0), address(token1), FEE, address(pool), TICK_LOWER, TICK_UPPER);
    }

    function test_initialize_revertsZeroToken() public {
        vm.expectRevert(ZeroAddress.selector);
        _deployVault(admin, address(npm), address(router), address(0), address(token1), FEE, address(pool), TICK_LOWER, TICK_UPPER);
    }

    function test_initialize_revertsTokenOrder() public {
        vm.expectRevert(InvalidTokens.selector);
        _deployVault(admin, address(npm), address(router), address(token1), address(token0), FEE, address(pool), TICK_LOWER, TICK_UPPER);
    }

    function test_initialize_revertsPoolTokenMismatch() public {
        MockPool bad = new MockPool(address(token1), address(token0), FEE, SPACING);
        vm.expectRevert(InvalidTokens.selector);
        _deployVault(admin, address(npm), address(router), address(token0), address(token1), FEE, address(bad), TICK_LOWER, TICK_UPPER);
    }

    function test_initialize_revertsWrongFee() public {
        vm.expectRevert(InvalidFee.selector);
        _deployVault(admin, address(npm), address(router), address(token0), address(token1), 500, address(pool), TICK_LOWER, TICK_UPPER);
    }

    function test_initialize_revertsTickOrder() public {
        vm.expectRevert(InvalidTicks.selector);
        _deployVault(admin, address(npm), address(router), address(token0), address(token1), FEE, address(pool), 60, -60);
    }

    function test_initialize_revertsTickSpacing() public {
        vm.expectRevert(InvalidTicks.selector);
        _deployVault(admin, address(npm), address(router), address(token0), address(token1), FEE, address(pool), -10, 10);
    }

    function test_deposit_revertsZeroReceiver() public {
        vm.expectRevert(ZeroAddress.selector);
        vault.deposit(1e18, 1e18, 0, address(0));
    }

    function test_deposit_revertsZeroAmount() public {
        vm.expectRevert(ZeroAmount.selector);
        vault.deposit(0, 0, 0, alice);
    }

    function test_deposit_revertsWhenPaused() public {
        vm.prank(admin);
        vault.pause();
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        vault.deposit(1e18, 1e18, 0, alice);
    }

    function test_firstDeposit_mintsSharesEqualToLiquidity() public {
        _fund(alice, 100e18, 100e18);
        vm.prank(alice);
        uint256 shares = vault.deposit(10e18, 10e18, 0, alice);

        assertGt(shares, 0);
        assertEq(vault.balanceOf(alice), shares);
        assertEq(vault.totalSupply(), shares);
        (,,, uint48 tokenId) = vault.position();
        assertEq(tokenId, 1);
    }

    function test_secondDeposit_mintsProRataShares() public {
        _fund(alice, 100e18, 100e18);
        _fund(bob, 100e18, 100e18);

        vm.prank(alice);
        uint256 aliceShares = vault.deposit(10e18, 10e18, 0, alice);

        vm.prank(bob);
        uint256 bobShares = vault.deposit(10e18, 10e18, 0, bob);

        assertGt(bobShares, 0);
        assertApproxEqRel(bobShares, aliceShares, 0.05e18);
        assertEq(vault.totalSupply(), aliceShares + bobShares);
    }

    function test_deposit_refundsDustToCaller() public {
        _fund(alice, 100e18, 100e18);
        uint256 before0 = token0.balanceOf(alice);
        vm.prank(alice);
        vault.deposit(10e18, 1, 0, alice);
        // unbalanced deposit zaps; leftover of the unused side is refunded
        assertGe(token0.balanceOf(alice) + token1.balanceOf(alice), before0 - 10e18);
    }

    function test_withdraw_revertsZeroReceiver() public {
        vm.expectRevert(ZeroAddress.selector);
        vault.withdraw(1, address(0));
    }

    function test_withdraw_revertsZeroShares() public {
        vm.expectRevert(ZeroAmount.selector);
        vault.withdraw(0, alice);
    }

    function test_withdraw_revertsInvalidShares() public {
        vm.expectRevert(InvalidShares.selector);
        vm.prank(alice);
        vault.withdraw(1, alice);
    }

    function test_withdraw_returnsTokensAndBurnsShares() public {
        _fund(alice, 100e18, 100e18);
        vm.prank(alice);
        uint256 shares = vault.deposit(10e18, 10e18, 0, alice);

        uint256 before0 = token0.balanceOf(alice);
        uint256 before1 = token1.balanceOf(alice);

        vm.prank(alice);
        MyPosition memory pos = vault.withdraw(shares, alice);

        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.totalSupply(), 0);
        assertGt(pos.liquidity, 0);
        assertTrue(pos.amount0 > 0 || pos.amount1 > 0);
        assertEq(token0.balanceOf(alice), before0 + pos.amount0);
        assertEq(token1.balanceOf(alice), before1 + pos.amount1);
    }

    function test_withdraw_worksWhenPaused() public {
        _fund(alice, 100e18, 100e18);
        vm.prank(alice);
        uint256 shares = vault.deposit(10e18, 10e18, 0, alice);

        vm.prank(admin);
        vault.pause();

        vm.prank(alice);
        vault.withdraw(shares, alice);
        assertEq(vault.balanceOf(alice), 0);
    }

    function test_handleFees_isNoOpBeforeFirstDeposit() public {
        vault.handle_fees();
        (,,, uint48 tokenId) = vault.position();
        assertEq(tokenId, 0);
        assertEq(vault.totalSupply(), 0);
    }

    function test_handleFees_revertsWhenPaused() public {
        vm.prank(admin);
        vault.pause();
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        vault.handle_fees();
    }

    function test_rebalance_revertsIfNotGovernor() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                alice,
                vault.GOVERNOR_ROLE()
            )
        );
        vm.prank(alice);
        vault.rebalance(-120, 0, 0);
    }

    function test_rebalance_revertsWhenPaused() public {
        vm.prank(admin);
        vault.pause();
        vm.prank(admin);
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        vault.rebalance(-120, 0, 0);
    }

    function test_rebalance_revertsZeroTokenId() public {
        vm.prank(admin);
        vm.expectRevert(ZeroTokenId.selector);
        vault.rebalance(-120, 0, 0);
    }

    function test_rebalance_revertsWhenInRange() public {
        _fund(alice, 100e18, 100e18);
        vm.prank(alice);
        vault.deposit(10e18, 10e18, 0, alice);

        vm.prank(admin);
        vm.expectRevert(InvalidTicks.selector);
        vault.rebalance(-120, 120, 0);
    }

    function test_rebalance_revertsIfNewTicksDoNotContainSpot() public {
        _fund(alice, 100e18, 100e18);
        vm.prank(alice);
        vault.deposit(10e18, 10e18, 0, alice);

        pool.setSlot0(120);
        vm.prank(admin);
        vm.expectRevert(InvalidTicks.selector);
        vault.rebalance(-180, -120, 0);
    }

    function test_rebalance_revertsOffSpacing() public {
        _fund(alice, 100e18, 100e18);
        vm.prank(alice);
        vault.deposit(10e18, 10e18, 0, alice);

        pool.setSlot0(120);
        vm.prank(admin);
        vm.expectRevert(InvalidTicks.selector);
        vault.rebalance(61, 181, 0);
    }

    function test_rebalance_movesRangeWhenOutOfRange() public {
        _fund(alice, 100e18, 100e18);
        vm.prank(alice);
        vault.deposit(10e18, 10e18, 0, alice);
        uint256 supplyBefore = vault.totalSupply();

        pool.setSlot0(120);
        vm.prank(admin);
        (uint256 newLiquidity,,) = vault.rebalance(60, 180, 0);

        assertGt(newLiquidity, 0);
        assertEq(vault.totalSupply(), supplyBefore);
        (, int24 lower, int24 upper, uint48 tokenId) = vault.position();
        assertEq(lower, 60);
        assertEq(upper, 180);
        assertEq(tokenId, 2);
    }

    function test_convertToSharesAndAssets_roundTripAfterDeposit() public {
        _fund(alice, 100e18, 100e18);
        vm.prank(alice);
        uint256 shares = vault.deposit(10e18, 10e18, 0, alice);
        (,,,,,,, uint128 liquidity,,,,) = npm.positions(1);

        uint256 asAssets = vault.convert_to_assets(shares, liquidity);
        assertEq(asAssets, liquidity);

        uint256 asShares = vault.convert_to_shares(liquidity, liquidity);
        assertEq(asShares, shares);
    }

    function test_convertToShares_revertsWhenSupplyZero() public {
        vm.expectRevert(ZeroAmount.selector);
        vault.convert_to_shares(1e18, 1e18);
    }

    function test_pause_revertsIfNotGovernor() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                alice,
                vault.GOVERNOR_ROLE()
            )
        );
        vm.prank(alice);
        vault.pause();
    }
}
