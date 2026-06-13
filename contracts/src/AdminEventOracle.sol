// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IEventOracle} from "./interfaces/IEventOracle.sol";

/// @title 管理员赛事结算预言机
/// @notice 由 owner 提交结果，经 72 小时异议期后最终化；挑战使用 USDC 质押。
contract AdminEventOracle is Ownable2Step, Pausable, IEventOracle {
    using SafeERC20 for IERC20;

    address private constant OWNABLE_INIT_SENTINEL = address(1);

    uint256 public constant DISPUTE_WINDOW = 72 hours;
    uint256 public constant CHALLENGE_STAKE = 100 * 1e6;
    uint256 public constant BONUS = 100 * 1e6;

    error ZeroAddress();
    error InvalidMaxOutcomes();
    error InvalidOutcomeIndex();
    error InvalidEventStatus();
    error AlreadyChallenged();
    error DisputeWindowOpen();
    error DisputeWindowExpired();

    struct Proposal {
        uint8 outcomeIndex;
        uint64 proposedAt;
        address challenger;
        uint64 challengedAt;
        EventStatus status;
    }

    IERC20 public immutable USDC;
    address public feeRecipient;
    address public bonusBank;
    uint8 public immutable MAX_OUTCOMES;

    mapping(bytes32 eventId => Proposal proposal) private proposals;

    event ResultProposed(bytes32 indexed eventId, uint8 outcomeIndex, uint64 proposedAt);
    event Challenged(bytes32 indexed eventId, address indexed challenger, uint64 challengedAt);
    event ProposalRevoked(
        bytes32 indexed eventId,
        address indexed challenger,
        uint8 outcomeIndex,
        uint256 refundedStake,
        uint256 bonus,
        uint64 revokedAt
    );
    event ProposalConfirmed(
        bytes32 indexed eventId,
        address indexed challenger,
        address indexed feeRecipient,
        uint8 outcomeIndex,
        uint256 forfeitedStake,
        uint64 confirmedAt
    );
    event Finalized(bytes32 indexed eventId, uint8 outcomeIndex, uint64 finalizedAt);
    event FinalizedOnTimeout(
        bytes32 indexed eventId, address indexed challenger, uint8 outcomeIndex, uint64 finalizedAt
    );

    /// @notice 创建管理员预言机，并设置 USDC、owner、协议手续费接收地址、挑战奖励金来源与最大结果数。
    /// @param usdc USDC 代币地址。
    /// @param initialOwner 初始 owner 地址。
    /// @param initialFeeRecipient 挑战被驳回时接收质押的地址。
    /// @param initialBonusBank 挑战成功时支付奖励金的地址。
    /// @param initialMaxOutcomes 单场事件允许的最大 outcome 数量。
    constructor(
        address usdc,
        address initialOwner,
        address initialFeeRecipient,
        address initialBonusBank,
        uint8 initialMaxOutcomes
    ) Ownable(initialOwner == address(0) ? OWNABLE_INIT_SENTINEL : initialOwner) {
        if (
            usdc == address(0) || initialOwner == address(0) || initialFeeRecipient == address(0)
                || initialBonusBank == address(0)
        ) revert ZeroAddress();
        if (initialMaxOutcomes == 0) revert InvalidMaxOutcomes();

        USDC = IERC20(usdc);
        feeRecipient = initialFeeRecipient;
        bonusBank = initialBonusBank;
        MAX_OUTCOMES = initialMaxOutcomes;
    }

    /// @notice 由 owner 为指定赛事提交结果提案，并开始 72 小时异议期。
    /// @param eventId 赛事唯一标识。
    /// @param outcomeIndex 提议的结果索引，必须小于 `MAX_OUTCOMES`。
    function proposeResult(bytes32 eventId, uint8 outcomeIndex) external onlyOwner whenNotPaused {
        if (outcomeIndex >= MAX_OUTCOMES) revert InvalidOutcomeIndex();

        Proposal storage proposal = proposals[eventId];
        if (proposal.status != EventStatus.Pending) revert InvalidEventStatus();

        proposal.outcomeIndex = outcomeIndex;
        proposal.proposedAt = uint64(block.timestamp);
        proposal.challenger = address(0);
        proposal.challengedAt = 0;
        proposal.status = EventStatus.Proposed;

        emit ResultProposed(eventId, outcomeIndex, proposal.proposedAt);
    }

    /// @notice 在异议期内对指定赛事提案发起挑战，并质押 100 USDC。
    /// @param eventId 赛事唯一标识。
    function challenge(bytes32 eventId) external whenNotPaused {
        Proposal storage proposal = proposals[eventId];

        if (proposal.status == EventStatus.Challenged) revert AlreadyChallenged();
        if (proposal.status != EventStatus.Proposed) revert InvalidEventStatus();
        if (_disputeDeadline(proposal) <= block.timestamp) revert DisputeWindowExpired();

        proposal.challenger = msg.sender;
        proposal.challengedAt = uint64(block.timestamp);
        proposal.status = EventStatus.Challenged;

        USDC.safeTransferFrom(msg.sender, address(this), CHALLENGE_STAKE);

        emit Challenged(eventId, msg.sender, proposal.challengedAt);
    }

    /// @notice 由 owner 撤销被挑战的提案，并向挑战者退还质押与奖励金。
    /// @param eventId 赛事唯一标识。
    function revokeProposal(bytes32 eventId) external onlyOwner whenNotPaused {
        Proposal memory proposal = _requireChallenged(eventId);

        delete proposals[eventId];

        USDC.safeTransfer(proposal.challenger, CHALLENGE_STAKE);
        // bonusBank 是构造期固定的奖励金账户，仅 owner 撤销被挑战提案时按固定金额付款。
        // slither-disable-next-line arbitrary-send-erc20
        USDC.safeTransferFrom(bonusBank, proposal.challenger, BONUS);

        emit ProposalRevoked(
            eventId, proposal.challenger, proposal.outcomeIndex, CHALLENGE_STAKE, BONUS, uint64(block.timestamp)
        );
    }

    /// @notice 由 owner 驳回挑战并确认原提案结果，同时将质押没收到 `feeRecipient`。
    /// @param eventId 赛事唯一标识。
    function confirmProposal(bytes32 eventId) external onlyOwner whenNotPaused {
        Proposal storage proposal = _requireChallengedStorage(eventId);

        address challenger = proposal.challenger;
        uint8 outcomeIndex = proposal.outcomeIndex;
        proposal.status = EventStatus.Finalized;

        USDC.safeTransfer(feeRecipient, CHALLENGE_STAKE);

        emit ProposalConfirmed(
            eventId, challenger, feeRecipient, outcomeIndex, CHALLENGE_STAKE, uint64(block.timestamp)
        );
    }

    /// @notice 在无挑战且异议期结束后，将赛事结果最终化。
    /// @param eventId 赛事唯一标识。
    function finalizeResult(bytes32 eventId) external whenNotPaused {
        Proposal storage proposal = proposals[eventId];
        if (proposal.status != EventStatus.Proposed) revert InvalidEventStatus();
        if (_disputeDeadline(proposal) > block.timestamp) revert DisputeWindowOpen();

        proposal.status = EventStatus.Finalized;

        emit Finalized(eventId, proposal.outcomeIndex, uint64(block.timestamp));
    }

    /// @notice 在挑战存在且 owner 超时未处理时，退还质押并按原提案结果最终化。
    /// @param eventId 赛事唯一标识。
    function finalizeOnTimeout(bytes32 eventId) external whenNotPaused {
        Proposal storage proposal = proposals[eventId];
        if (proposal.status != EventStatus.Challenged) revert InvalidEventStatus();
        if (_disputeDeadline(proposal) > block.timestamp) revert DisputeWindowOpen();

        address challenger = proposal.challenger;
        uint8 outcomeIndex = proposal.outcomeIndex;
        proposal.status = EventStatus.Finalized;

        USDC.safeTransfer(challenger, CHALLENGE_STAKE);

        emit FinalizedOnTimeout(eventId, challenger, outcomeIndex, uint64(block.timestamp));
    }

    /// @notice 读取赛事当前结果；若尚未最终化，`finalized` 为 `false`。
    /// @param eventId 赛事唯一标识。
    /// @return outcomeIndex 当前记录的结果索引。
    /// @return finalized 结果是否已经最终化。
    function getResult(bytes32 eventId) external view returns (uint8 outcomeIndex, bool finalized) {
        Proposal storage proposal = proposals[eventId];
        return (proposal.outcomeIndex, proposal.status == EventStatus.Finalized);
    }

    /// @notice 读取赛事当前状态。
    /// @param eventId 赛事唯一标识。
    /// @return status 当前事件状态。
    function getEventStatus(bytes32 eventId) external view returns (EventStatus status) {
        return proposals[eventId].status;
    }

    /// @notice 由 owner 暂停所有状态变更方法。
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice 由 owner 恢复所有状态变更方法。
    function unpause() external onlyOwner {
        _unpause();
    }

    function _disputeDeadline(Proposal storage proposal) internal view returns (uint256) {
        return uint256(proposal.proposedAt) + DISPUTE_WINDOW;
    }

    function _requireChallenged(bytes32 eventId) internal view returns (Proposal memory proposal) {
        proposal = proposals[eventId];
        if (proposal.status != EventStatus.Challenged) revert InvalidEventStatus();
    }

    function _requireChallengedStorage(bytes32 eventId) internal view returns (Proposal storage proposal) {
        proposal = proposals[eventId];
        if (proposal.status != EventStatus.Challenged) revert InvalidEventStatus();
    }
}
