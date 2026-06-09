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
}

contract PredictionMarketSmokeTest is PredictionMarketTestBase {
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
