// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Test} from "forge-std/Test.sol";
import {AdminEventOracle} from "../src/AdminEventOracle.sol";
import {IEventOracle} from "../src/interfaces/IEventOracle.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract AdminEventOracleTest is Test {
    uint256 internal constant INITIAL_BALANCE = 1_000_000_000;
    bytes32 internal constant EVENT_ID = keccak256("event-1");
    bytes32 internal constant EVENT_ID_2 = keccak256("event-2");
    bytes32 internal constant EVENT_ID_3 = keccak256("event-3");
    uint8 internal constant MAX_OUTCOMES = 3;

    address internal owner = address(0xA001);
    address internal feeRecipient = address(0xA002);
    address internal bonusBank = address(0xA003);
    address internal challenger = address(0xA101);
    address internal otherUser = address(0xA102);

    MockUSDC internal usdc;
    AdminEventOracle internal oracle;

    function setUp() public {
        usdc = new MockUSDC();

        oracle = new AdminEventOracle(address(usdc), owner, feeRecipient, bonusBank, MAX_OUTCOMES);

        usdc.mint(challenger, INITIAL_BALANCE);
        usdc.mint(otherUser, INITIAL_BALANCE);
        usdc.mint(bonusBank, INITIAL_BALANCE);

        vm.prank(challenger);
        usdc.approve(address(oracle), type(uint256).max);

        vm.prank(otherUser);
        usdc.approve(address(oracle), type(uint256).max);

        vm.prank(bonusBank);
        usdc.approve(address(oracle), type(uint256).max);
    }

    function test_proposeAndFinalize_NoChallenge() public {
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID, 1);

        (uint8 outcomeIndex, bool finalized) = oracle.getResult(EVENT_ID);
        assertEq(outcomeIndex, 1);
        assertFalse(finalized);
        assertEq(uint8(oracle.getEventStatus(EVENT_ID)), uint8(IEventOracle.EventStatus.Proposed));

        vm.warp(block.timestamp + oracle.DISPUTE_WINDOW());

        vm.prank(otherUser);
        oracle.finalizeResult(EVENT_ID);

        (outcomeIndex, finalized) = oracle.getResult(EVENT_ID);
        assertEq(outcomeIndex, 1);
        assertTrue(finalized);
        assertEq(uint8(oracle.getEventStatus(EVENT_ID)), uint8(IEventOracle.EventStatus.Finalized));
    }

    function test_unregisteredEvent_DefaultsToPending() public view {
        bytes32 unregisteredEventId = keccak256("unregistered-event");

        assertEq(uint8(oracle.getEventStatus(unregisteredEventId)), uint8(IEventOracle.EventStatus.Pending));
    }

    function test_challenge_OwnerRevokes_ChallengerRefundedWithBonus() public {
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID, 2);

        vm.prank(challenger);
        oracle.challenge(EVENT_ID);

        assertEq(usdc.balanceOf(address(oracle)), oracle.CHALLENGE_STAKE());
        assertEq(usdc.balanceOf(challenger), INITIAL_BALANCE - oracle.CHALLENGE_STAKE());
        assertEq(uint8(oracle.getEventStatus(EVENT_ID)), uint8(IEventOracle.EventStatus.Challenged));

        vm.prank(owner);
        oracle.revokeProposal(EVENT_ID);

        (uint8 outcomeIndex, bool finalized) = oracle.getResult(EVENT_ID);
        assertEq(outcomeIndex, 0);
        assertFalse(finalized);
        assertEq(uint8(oracle.getEventStatus(EVENT_ID)), uint8(IEventOracle.EventStatus.Pending));
        assertEq(usdc.balanceOf(address(oracle)), 0);
        assertEq(usdc.balanceOf(challenger), INITIAL_BALANCE + oracle.BONUS());
        assertEq(usdc.balanceOf(bonusBank), INITIAL_BALANCE - oracle.BONUS());

        vm.prank(owner);
        oracle.proposeResult(EVENT_ID, 0);
        assertEq(uint8(oracle.getEventStatus(EVENT_ID)), uint8(IEventOracle.EventStatus.Proposed));
    }

    function test_challenge_OwnerConfirms_ChallengerStakeForfeited() public {
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID, 1);

        vm.prank(challenger);
        oracle.challenge(EVENT_ID);

        vm.prank(owner);
        oracle.confirmProposal(EVENT_ID);

        (uint8 outcomeIndex, bool finalized) = oracle.getResult(EVENT_ID);
        assertEq(outcomeIndex, 1);
        assertTrue(finalized);
        assertEq(uint8(oracle.getEventStatus(EVENT_ID)), uint8(IEventOracle.EventStatus.Finalized));
        assertEq(usdc.balanceOf(challenger), INITIAL_BALANCE - oracle.CHALLENGE_STAKE());
        assertEq(usdc.balanceOf(feeRecipient), oracle.CHALLENGE_STAKE());
        assertEq(usdc.balanceOf(address(oracle)), 0);
    }

    function test_challenge_OwnerInactive_FinalizeOnTimeout_StakeRefundedNoBonus() public {
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID, 1);

        vm.prank(challenger);
        oracle.challenge(EVENT_ID);

        vm.warp(block.timestamp + oracle.DISPUTE_WINDOW());

        vm.prank(otherUser);
        oracle.finalizeOnTimeout(EVENT_ID);

        (uint8 outcomeIndex, bool finalized) = oracle.getResult(EVENT_ID);
        assertEq(outcomeIndex, 1);
        assertTrue(finalized);
        assertEq(uint8(oracle.getEventStatus(EVENT_ID)), uint8(IEventOracle.EventStatus.Finalized));
        assertEq(usdc.balanceOf(challenger), INITIAL_BALANCE);
        assertEq(usdc.balanceOf(bonusBank), INITIAL_BALANCE);
        assertEq(usdc.balanceOf(address(oracle)), 0);
    }

    function test_pause_BlocksAllMutations_ReadsStillWork() public {
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID, 2);

        vm.prank(owner);
        oracle.pause();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID_2, 1);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(challenger);
        oracle.challenge(EVENT_ID);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(owner);
        oracle.revokeProposal(EVENT_ID);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(owner);
        oracle.confirmProposal(EVENT_ID);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(otherUser);
        oracle.finalizeResult(EVENT_ID);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(otherUser);
        oracle.finalizeOnTimeout(EVENT_ID);

        (uint8 outcomeIndex, bool finalized) = oracle.getResult(EVENT_ID);
        assertEq(outcomeIndex, 2);
        assertFalse(finalized);
        assertEq(uint8(oracle.getEventStatus(EVENT_ID)), uint8(IEventOracle.EventStatus.Proposed));

        vm.prank(owner);
        oracle.unpause();

        vm.prank(challenger);
        oracle.challenge(EVENT_ID);
        assertEq(uint8(oracle.getEventStatus(EVENT_ID)), uint8(IEventOracle.EventStatus.Challenged));
    }

    function test_nonOwner_Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, challenger));
        vm.prank(challenger);
        oracle.proposeResult(EVENT_ID, 1);

        vm.prank(owner);
        oracle.proposeResult(EVENT_ID, 1);

        vm.prank(challenger);
        oracle.challenge(EVENT_ID);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, challenger));
        vm.prank(challenger);
        oracle.revokeProposal(EVENT_ID);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, challenger));
        vm.prank(challenger);
        oracle.confirmProposal(EVENT_ID);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, challenger));
        vm.prank(challenger);
        oracle.pause();

        vm.prank(owner);
        oracle.pause();

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, challenger));
        vm.prank(challenger);
        oracle.unpause();
    }

    function test_doubleChallenge_Reverts() public {
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID, 2);

        vm.prank(challenger);
        oracle.challenge(EVENT_ID);

        vm.expectRevert(AdminEventOracle.AlreadyChallenged.selector);
        vm.prank(otherUser);
        oracle.challenge(EVENT_ID);
    }

    function test_finalizeBeforeWindow_Reverts() public {
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID, 1);

        vm.warp(block.timestamp + oracle.DISPUTE_WINDOW() - 1);

        vm.expectRevert(AdminEventOracle.DisputeWindowOpen.selector);
        vm.prank(otherUser);
        oracle.finalizeResult(EVENT_ID);

        vm.prank(owner);
        oracle.proposeResult(EVENT_ID_2, 2);

        vm.prank(challenger);
        oracle.challenge(EVENT_ID_2);

        vm.expectRevert(AdminEventOracle.DisputeWindowOpen.selector);
        vm.prank(otherUser);
        oracle.finalizeOnTimeout(EVENT_ID_2);
    }

    function test_constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(AdminEventOracle.ZeroAddress.selector);
        new AdminEventOracle(address(0), owner, feeRecipient, bonusBank, MAX_OUTCOMES);
    }

    function test_constructor_RevertsOnZeroMaxOutcomes() public {
        vm.expectRevert(AdminEventOracle.InvalidMaxOutcomes.selector);
        new AdminEventOracle(address(usdc), owner, feeRecipient, bonusBank, 0);
    }

    function test_proposeResult_RevertsOnInvalidOutcomeIndex() public {
        vm.expectRevert(AdminEventOracle.InvalidOutcomeIndex.selector);
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID, MAX_OUTCOMES);
    }

    function test_proposeResult_RevertsWhenEventIsNotPending() public {
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID, 1);

        vm.expectRevert(AdminEventOracle.InvalidEventStatus.selector);
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID, 2);
    }

    function test_challenge_RevertsWithoutProposal() public {
        vm.expectRevert(AdminEventOracle.InvalidEventStatus.selector);
        vm.prank(challenger);
        oracle.challenge(EVENT_ID_3);
    }

    function test_challenge_RevertsAfterDisputeWindowExpired() public {
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID_3, 1);

        vm.warp(block.timestamp + oracle.DISPUTE_WINDOW());

        vm.expectRevert(AdminEventOracle.DisputeWindowExpired.selector);
        vm.prank(challenger);
        oracle.challenge(EVENT_ID_3);
    }

    function test_ownerResolution_RevertsWithoutChallenge() public {
        vm.prank(owner);
        oracle.proposeResult(EVENT_ID_3, 1);

        vm.expectRevert(AdminEventOracle.InvalidEventStatus.selector);
        vm.prank(owner);
        oracle.revokeProposal(EVENT_ID_3);

        vm.expectRevert(AdminEventOracle.InvalidEventStatus.selector);
        vm.prank(owner);
        oracle.confirmProposal(EVENT_ID_3);
    }

    function test_finalizePaths_RevertOnWrongStatus() public {
        vm.expectRevert(AdminEventOracle.InvalidEventStatus.selector);
        vm.prank(otherUser);
        oracle.finalizeResult(EVENT_ID_2);

        vm.prank(owner);
        oracle.proposeResult(EVENT_ID_2, 2);

        vm.prank(challenger);
        oracle.challenge(EVENT_ID_2);

        vm.expectRevert(AdminEventOracle.InvalidEventStatus.selector);
        vm.prank(otherUser);
        oracle.finalizeResult(EVENT_ID_2);

        vm.expectRevert(AdminEventOracle.InvalidEventStatus.selector);
        vm.prank(otherUser);
        oracle.finalizeOnTimeout(EVENT_ID);
    }
}
