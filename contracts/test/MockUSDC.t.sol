// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract MockUSDCCallbackTarget {
    uint256 public callCount;
    uint256 public lastValue;
    address public lastSender;

    function record(uint256 value) external {
        callCount += 1;
        lastValue = value;
        lastSender = msg.sender;
    }

    function fail() external pure {
        revert("MockUSDCCallbackTarget: fail");
    }
}

contract MockUSDCTest is Test {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    MockUSDC internal mockUsdc;
    MockUSDCCallbackTarget internal callbackTarget;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal spender = makeAddr("spender");

    function setUp() public {
        mockUsdc = new MockUSDC();
        callbackTarget = new MockUSDCCallbackTarget();
    }

    function test_Metadata_IsExpectedUSDCValues() external view {
        assertEq(mockUsdc.name(), "USDC");
        assertEq(mockUsdc.symbol(), "USDC");
        assertEq(mockUsdc.decimals(), 6);
    }

    function test_Mint_IncreasesTotalSupplyAndBalance_AndEmitsTransfer() external {
        uint256 amount = 12_345_678;

        vm.expectEmit(true, true, false, true, address(mockUsdc));
        emit Transfer(address(0), alice, amount);

        mockUsdc.mint(alice, amount);

        assertEq(mockUsdc.totalSupply(), amount);
        assertEq(mockUsdc.balanceOf(alice), amount);
    }

    function test_Approve_SetsAllowance_AndEmitsApproval() external {
        uint256 amount = 9_999_999;

        vm.expectEmit(true, true, false, true, address(mockUsdc));
        emit Approval(alice, spender, amount);

        vm.prank(alice);
        bool ok = mockUsdc.approve(spender, amount);

        assertTrue(ok);
        assertEq(mockUsdc.allowance(alice, spender), amount);
    }

    function test_Transfer_MovesBalance() external {
        mockUsdc.mint(alice, 2_000_000);

        vm.prank(alice);
        bool ok = mockUsdc.transfer(bob, 750_000);

        assertTrue(ok);
        assertEq(mockUsdc.balanceOf(alice), 1_250_000);
        assertEq(mockUsdc.balanceOf(bob), 750_000);
    }

    function test_Transfer_RevertsWhenBalanceIsInsufficient() external {
        vm.prank(alice);
        vm.expectRevert(bytes("MockUSDC: balance"));
        mockUsdc.transfer(bob, 1);
    }

    function test_TransferFrom_RevertsWhenAllowanceIsInsufficient() external {
        mockUsdc.mint(alice, 1_000_000);

        vm.prank(spender);
        vm.expectRevert(bytes("MockUSDC: allowance"));
        mockUsdc.transferFrom(alice, bob, 1);
    }

    function test_TransferFrom_DecreasesFiniteAllowance() external {
        mockUsdc.mint(alice, 1_000_000);

        vm.prank(alice);
        mockUsdc.approve(spender, 600_000);

        vm.prank(spender);
        bool ok = mockUsdc.transferFrom(alice, bob, 400_000);

        assertTrue(ok);
        assertEq(mockUsdc.balanceOf(alice), 600_000);
        assertEq(mockUsdc.balanceOf(bob), 400_000);
        assertEq(mockUsdc.allowance(alice, spender), 200_000);
    }

    function test_TransferFrom_DoesNotDecreaseMaxAllowance() external {
        mockUsdc.mint(alice, 1_000_000);

        vm.prank(alice);
        mockUsdc.approve(spender, type(uint256).max);

        vm.prank(spender);
        bool ok = mockUsdc.transferFrom(alice, bob, 400_000);

        assertTrue(ok);
        assertEq(mockUsdc.balanceOf(alice), 600_000);
        assertEq(mockUsdc.balanceOf(bob), 400_000);
        assertEq(mockUsdc.allowance(alice, spender), type(uint256).max);
    }

    function test_TransferToCallback_InvokesCallbackAndClearsFlag() external {
        bytes memory callbackData = abi.encodeCall(MockUSDCCallbackTarget.record, (42));

        mockUsdc.mint(alice, 1_000_000);
        mockUsdc.setReentrancyCallback(address(callbackTarget), callbackData);

        assertEq(mockUsdc.reentrancyCallback(), address(callbackTarget));
        assertEq(mockUsdc.reentrancyData(), callbackData);

        vm.prank(alice);
        bool ok = mockUsdc.transfer(address(callbackTarget), 250_000);

        assertTrue(ok);
        assertEq(mockUsdc.balanceOf(alice), 750_000);
        assertEq(mockUsdc.balanceOf(address(callbackTarget)), 250_000);
        assertEq(callbackTarget.callCount(), 1);
        assertEq(callbackTarget.lastValue(), 42);
        assertEq(callbackTarget.lastSender(), address(mockUsdc));
        assertEq(mockUsdc.reentrancyCallback(), address(0));

        vm.prank(alice);
        bool okSecond = mockUsdc.transfer(address(callbackTarget), 100_000);

        assertTrue(okSecond);

        assertEq(callbackTarget.callCount(), 1);
    }

    function test_TransferToCallback_RevertsWhenCallbackFails() external {
        bytes memory callbackData = abi.encodeCall(MockUSDCCallbackTarget.fail, ());

        mockUsdc.mint(alice, 1_000_000);
        mockUsdc.setReentrancyCallback(address(callbackTarget), callbackData);

        vm.prank(alice);
        vm.expectRevert(bytes("MockUSDC: reentrancy call failed"));
        mockUsdc.transfer(address(callbackTarget), 250_000);

        assertEq(mockUsdc.balanceOf(alice), 1_000_000);
        assertEq(mockUsdc.balanceOf(address(callbackTarget)), 0);
    }
}
