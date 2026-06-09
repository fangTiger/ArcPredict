// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockPyth} from "./mocks/MockPyth.sol";

contract PredictionMarketTestBase is Test {
    PredictionMarket public market;
    MockUSDC public usdc;
    MockPyth public pyth;

    uint256 internal constant INITIAL_USDC_BALANCE = 1_000_000_000;
    uint256 internal constant INITIAL_NATIVE_BALANCE = 10 ether;
    bytes32 public constant PRICE_ID_BTC = bytes32(uint256(1));
    int32 public constant EXPO_8 = -8;

    address public owner = address(0xA001);
    address public feeRecipient = address(0xA002);
    address public alice = address(0xA101);
    address public bob = address(0xA102);
    address public carol = address(0xA103);

    function setUp() public {
        usdc = new MockUSDC();
        pyth = new MockPyth();

        vm.prank(owner);
        market = new PredictionMarket(address(usdc), address(pyth), owner, feeRecipient);

        address[3] memory users = [alice, bob, carol];
        for (uint256 i = 0; i < users.length; i++) {
            usdc.mint(users[i], INITIAL_USDC_BALANCE);

            vm.prank(users[i]);
            usdc.approve(address(market), type(uint256).max);

            vm.deal(users[i], INITIAL_NATIVE_BALANCE);
        }
    }

    function _makeMarket(int64 threshold, uint64 inHours) internal returns (uint256 id) {
        vm.prank(owner);
        id = market.createMarket(
            PRICE_ID_BTC,
            threshold,
            EXPO_8,
            uint64(block.timestamp + inHours * 1 hours),
            uint64(block.timestamp + inHours * 1 hours + 1 minutes),
            "Test market"
        );
    }
}

contract PredictionMarketSmokeTest is PredictionMarketTestBase {
    function test_TestBase_DefinesMarketConstants() public pure {
        assertEq(PRICE_ID_BTC, bytes32(uint256(1)));
        assertEq(EXPO_8, -8);
    }

    function test_Deployment_SetsImmutables() public view {
        assertEq(market.USDC(), address(usdc));
        assertEq(market.PYTH(), address(pyth));
        assertEq(market.owner(), owner);
        assertEq(market.feeRecipient(), feeRecipient);
        assertEq(market.feeBps(), 100);
        assertEq(market.marketCount(), 0);
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(PredictionMarket.ZeroAddress.selector);
        new PredictionMarket(address(0), address(pyth), owner, feeRecipient);
    }

    function test_SetUp_SeedsUsersAndApprovals() public view {
        _assertSeededUser(alice);
        _assertSeededUser(bob);
        _assertSeededUser(carol);
    }

    function _assertSeededUser(address user) internal view {
        assertEq(usdc.balanceOf(user), INITIAL_USDC_BALANCE);
        assertEq(usdc.allowance(user, address(market)), type(uint256).max);
        assertEq(user.balance, INITIAL_NATIVE_BALANCE);
    }
}

contract CreateMarketTest is PredictionMarketTestBase {
    function test_CreateMarket_HappyPath() public {
        vm.prank(owner);
        uint256 id = market.createMarket(
            PRICE_ID_BTC,
            70000_00000000,
            EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1 minutes),
            "BTC >= 70k"
        );
        assertEq(id, 0);
        assertEq(market.marketCount(), 1);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.pythPriceId, PRICE_ID_BTC);
        assertEq(m.threshold, 70000_00000000);
        assertEq(m.thresholdExpo, EXPO_8);
        assertEq(m.feeBpsSnapshot, 100);
        assertEq(m.feeRecipientSnapshot, feeRecipient);
        assertEq(uint8(m.outcome), uint8(PredictionMarket.Outcome.Unresolved));
    }

    function test_CreateMarket_NonOwnerReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        market.createMarket(
            PRICE_ID_BTC,
            70000_00000000,
            EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1 minutes),
            "x"
        );
    }
}
