// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IEventOracle} from "./interfaces/IEventOracle.sol";

/// @title ArcPredict 世界杯事件市场合约
/// @notice 单合约管理多个离散 outcome 市场，使用内部持仓记账，不铸造可转让 outcome token。
contract EventMarket is Ownable2Step {
    using SafeERC20 for IERC20;

    address private constant OWNABLE_INIT_SENTINEL = address(1);

    uint256 public constant MAX_MARKETS = 1000;
    uint128 public constant MIN_BET = 1e5;
    uint16 public constant MAX_FEE_BPS = 500;
    uint256 public constant MAX_QUESTION_LEN = 200;
    uint8 public constant UNRESOLVED_OUTCOME = type(uint8).max;
    uint8 public constant INVALID_OUTCOME = type(uint8).max - 1;

    struct EventMarketDef {
        bytes32 eventId;
        uint8 outcomeCount;
        uint64 betDeadline;
        uint64 resolveAfter;
        uint128[] outcomePools;
        uint128 winnerPool;
        uint128 protocolFee;
        uint16 feeBpsSnapshot;
        address feeRecipientSnapshot;
        uint8 settledOutcome;
        uint64 settleTime;
        string question;
    }

    struct DashboardRow {
        uint256 id;
        EventMarketDef market;
        uint128[] userOutcomeStakes;
        bool claimed_;
        uint256 pendingPayout;
    }

    // 与 PredictionMarket 保持“单合约多市场 + marketCount + claimed + fee snapshot + immutable USDC”
    // 的结构同构；主要差异是：
    // 1) yes/no 双池替换为动态 outcomePools
    // 2) 用户持仓改为三层映射 stakeByOutcome
    // 3) 结算源由 Pyth 替换为 IEventOracle
    mapping(uint256 => EventMarketDef) private _markets;
    mapping(uint256 => mapping(address => mapping(uint8 => uint128))) public stakeByOutcome;
    mapping(uint256 => mapping(address => bool)) public claimed;
    uint256 public marketCount;

    address public feeRecipient;
    uint16 public feeBps = 100;
    address public immutable USDC;
    IEventOracle public immutable ORACLE;

    event MarketCreated(
        uint256 indexed id,
        bytes32 indexed eventId,
        uint8 outcomeCount,
        uint64 betDeadline,
        uint64 resolveAfter,
        uint16 feeBpsSnapshot,
        address feeRecipientSnapshot,
        string question
    );
    event Bet(
        uint256 indexed id,
        address indexed user,
        uint8 indexed outcomeIndex,
        uint128 amount,
        uint128 outcomePoolAfter,
        uint128 totalPoolAfter
    );
    event Resolved(
        uint256 indexed id, uint8 settledOutcome, uint64 settleTime, uint128 winnerPool, uint128 protocolFee
    );
    event Claimed(uint256 indexed id, address indexed user, uint256 payout);

    error MarketLimitReached();
    error InvalidTimeOrder();
    error TimesInPast();
    error ZeroAddress();
    error FeeTooHigh();
    error QuestionTooLong();
    error InvalidEventId();
    error InvalidOutcomeCount();
    error InvalidOutcomeIndex();
    error BettingClosed();
    error BelowMinBet();
    error AlreadyResolved();
    error NotResolvableYet();
    error OracleResultNotFinalized();
    error NotResolved();
    error AlreadyClaimed();
    error NotAWinner();
    error NoPayoutAvailable();
    error InvalidMarketId();

    /// @notice 创建 EventMarket，并设置 USDC、owner、协议费接收地址与赛事预言机。
    /// @param usdc USDC 代币地址。
    /// @param initialOwner 初始 owner 地址。
    /// @param initialFeeRecipient 协议费接收地址。
    /// @param eventOracle 事件结果预言机地址。
    constructor(address usdc, address initialOwner, address initialFeeRecipient, address eventOracle)
        Ownable(initialOwner == address(0) ? OWNABLE_INIT_SENTINEL : initialOwner)
    {
        if (
            usdc == address(0) || initialOwner == address(0) || initialFeeRecipient == address(0)
                || eventOracle == address(0)
        ) revert ZeroAddress();

        USDC = usdc;
        ORACLE = IEventOracle(eventOracle);
        feeRecipient = initialFeeRecipient;
    }

    /// @notice 创建一个新的多 outcome 市场。
    /// @param eventId 赛事唯一标识。
    /// @param outcomeCount outcome 数量，必须在 [2, 32] 范围内。
    /// @param betDeadline 截止下注时间。
    /// @param resolveAfter 最早允许结算时间。
    /// @param question 市场问题文本。
    /// @return id 新市场 ID。
    function createMarket(
        bytes32 eventId,
        uint8 outcomeCount,
        uint64 betDeadline,
        uint64 resolveAfter,
        string calldata question
    ) external onlyOwner returns (uint256 id) {
        if (marketCount >= MAX_MARKETS) revert MarketLimitReached();
        if (eventId == bytes32(0)) revert InvalidEventId();
        if (outcomeCount < 2 || outcomeCount > 32) revert InvalidOutcomeCount();
        if (betDeadline <= block.timestamp) revert TimesInPast();
        if (resolveAfter <= betDeadline) revert InvalidTimeOrder();
        if (bytes(question).length > MAX_QUESTION_LEN) revert QuestionTooLong();

        id = marketCount++;
        EventMarketDef storage m = _markets[id];
        m.eventId = eventId;
        m.outcomeCount = outcomeCount;
        m.betDeadline = betDeadline;
        m.resolveAfter = resolveAfter;
        m.outcomePools = new uint128[](outcomeCount);
        m.feeBpsSnapshot = feeBps;
        m.feeRecipientSnapshot = feeRecipient;
        m.settledOutcome = UNRESOLVED_OUTCOME;
        m.question = question;

        emit MarketCreated(
            id, eventId, outcomeCount, betDeadline, resolveAfter, m.feeBpsSnapshot, m.feeRecipientSnapshot, question
        );
    }

    /// @notice 调整后续市场的协议费率。
    /// @param bps 新费率，单位 BPS。
    function setFeeBps(uint16 bps) external onlyOwner {
        if (bps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = bps;
    }

    /// @notice 调整后续市场的协议费接收地址。
    /// @param recipient 新接收地址。
    function setFeeRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        feeRecipient = recipient;
    }

    /// @notice 读取单个市场的 tuple 视图，便于与现有前端读取模式保持兼容。
    /// @param id 市场 ID。
    function markets(uint256 id)
        external
        view
        returns (
            bytes32 eventId,
            uint8 outcomeCount,
            uint64 betDeadline,
            uint64 resolveAfter,
            uint128[] memory outcomePools,
            uint128 winnerPool,
            uint128 protocolFee,
            uint16 feeBpsSnapshot,
            address feeRecipientSnapshot,
            uint8 settledOutcome,
            uint64 settleTime,
            string memory question
        )
    {
        _requireValidMarketId(id);

        EventMarketDef memory m = _markets[id];
        return (
            m.eventId,
            m.outcomeCount,
            m.betDeadline,
            m.resolveAfter,
            m.outcomePools,
            m.winnerPool,
            m.protocolFee,
            m.feeBpsSnapshot,
            m.feeRecipientSnapshot,
            m.settledOutcome,
            m.settleTime,
            m.question
        );
    }

    /// @notice 读取单个市场完整结构体。
    /// @param id 市场 ID。
    /// @return 市场结构体副本。
    function getMarket(uint256 id) external view returns (EventMarketDef memory) {
        _requireValidMarketId(id);
        return _markets[id];
    }

    /// @notice 分页读取多个市场。
    /// @param from 起始 ID（含）。
    /// @param toExclusive 结束 ID（不含）。
    /// @return out 市场数组。
    function getMarketsPaged(uint256 from, uint256 toExclusive) external view returns (EventMarketDef[] memory out) {
        if (toExclusive > marketCount || from > toExclusive) revert InvalidMarketId();

        out = new EventMarketDef[](toExclusive - from);
        for (uint256 i = 0; i < out.length; i++) {
            out[i] = _markets[from + i];
        }
    }

    /// @notice 为指定 outcome 下注。
    /// @param id 市场 ID。
    /// @param outcomeIndex outcome 索引。
    /// @param amount 下注金额，单位为 USDC 最小精度。
    function bet(uint256 id, uint8 outcomeIndex, uint128 amount) external {
        _requireValidMarketId(id);

        EventMarketDef storage m = _markets[id];
        if (m.settledOutcome != UNRESOLVED_OUTCOME) revert AlreadyResolved();
        if (block.timestamp >= m.betDeadline) revert BettingClosed();
        if (amount < MIN_BET) revert BelowMinBet();
        if (outcomeIndex >= m.outcomeCount) revert InvalidOutcomeIndex();

        IERC20(USDC).safeTransferFrom(msg.sender, address(this), amount);

        m.outcomePools[outcomeIndex] += amount;
        stakeByOutcome[id][msg.sender][outcomeIndex] += amount;

        emit Bet(id, msg.sender, outcomeIndex, amount, m.outcomePools[outcomeIndex], _sumPools(m.outcomePools));
    }

    /// @notice 在 `resolveAfter` 之后，依据预言机最终结果结算市场。
    /// @param id 市场 ID。
    function resolve(uint256 id) external {
        _requireValidMarketId(id);

        EventMarketDef storage m = _markets[id];
        if (m.settledOutcome != UNRESOLVED_OUTCOME) revert AlreadyResolved();
        if (block.timestamp < m.resolveAfter) revert NotResolvableYet();

        (uint8 outcomeIndex, bool finalized) = ORACLE.getResult(m.eventId);
        if (!finalized) revert OracleResultNotFinalized();

        m.settleTime = uint64(block.timestamp);

        if (outcomeIndex >= m.outcomeCount) {
            m.settledOutcome = INVALID_OUTCOME;
            m.winnerPool = 0;
            m.protocolFee = 0;
            emit Resolved(id, INVALID_OUTCOME, m.settleTime, 0, 0);
            return;
        }

        uint128 totalPool = _sumPools(m.outcomePools);
        uint128 winningPool = m.outcomePools[outcomeIndex];

        if (totalPool < 1 || winningPool < 1) {
            m.settledOutcome = INVALID_OUTCOME;
            m.winnerPool = 0;
            m.protocolFee = 0;
            emit Resolved(id, INVALID_OUTCOME, m.settleTime, 0, 0);
            return;
        }

        uint128 losingPool = totalPool - winningPool;
        uint128 protocolFee = uint128(uint256(losingPool) * m.feeBpsSnapshot / 10_000);

        m.settledOutcome = outcomeIndex;
        m.protocolFee = protocolFee;
        m.winnerPool = totalPool - protocolFee;

        if (protocolFee > 0) {
            IERC20(USDC).safeTransfer(m.feeRecipientSnapshot, protocolFee);
        }

        emit Resolved(id, outcomeIndex, m.settleTime, m.winnerPool, protocolFee);
    }

    /// @notice 领取已结算市场的奖金或 invalid/refund 退款。
    /// @param id 市场 ID。
    function claim(uint256 id) external {
        _requireValidMarketId(id);

        EventMarketDef storage m = _markets[id];
        if (m.settledOutcome == UNRESOLVED_OUTCOME) revert NotResolved();
        if (claimed[id][msg.sender]) revert AlreadyClaimed();

        uint256 totalStake = _userTotalStake(id, msg.sender, m.outcomeCount);
        if (totalStake == 0) revert NoPayoutAvailable();

        if (m.settledOutcome != INVALID_OUTCOME && stakeByOutcome[id][msg.sender][m.settledOutcome] == 0) {
            revert NotAWinner();
        }

        uint256 payout = _quotePayout(id, msg.sender);

        claimed[id][msg.sender] = true;
        IERC20(USDC).safeTransfer(msg.sender, payout);

        emit Claimed(id, msg.sender, payout);
    }

    /// @notice 返回指定用户在某个市场上的全 outcome 持仓。
    /// @param id 市场 ID。
    /// @param user 用户地址。
    /// @return stakes 各 outcome 的持仓数组。
    function userStake(uint256 id, address user) external view returns (uint128[] memory stakes) {
        _requireValidMarketId(id);

        EventMarketDef storage m = _markets[id];
        stakes = new uint128[](m.outcomeCount);
        for (uint8 i = 0; i < m.outcomeCount; i++) {
            stakes[i] = stakeByOutcome[id][user][i];
        }
    }

    /// @notice 查询指定用户尚未领取的可得金额。
    /// @param id 市场 ID。
    /// @param user 用户地址。
    /// @return payout 当前可领取金额。
    function pendingPayout(uint256 id, address user) external view returns (uint256 payout) {
        _requireValidMarketId(id);
        if (claimed[id][user]) return 0;
        return _quotePayout(id, user);
    }

    /// @notice 按 ID 区间读取 dashboard 行。
    /// @param user 用户地址。
    /// @param from 起始 ID（含）。
    /// @param toExclusive 结束 ID（不含）。
    /// @return rows dashboard 行数组。
    /// @return totalCount 市场总数。
    function getDashboard(address user, uint256 from, uint256 toExclusive)
        external
        view
        returns (DashboardRow[] memory rows, uint256 totalCount)
    {
        if (toExclusive > marketCount || from > toExclusive) revert InvalidMarketId();

        totalCount = marketCount;
        rows = new DashboardRow[](toExclusive - from);
        for (uint256 i = 0; i < rows.length; i++) {
            rows[i] = _dashboardRow(from + i, user);
        }
    }

    /// @notice 按最新优先读取 dashboard 行。
    /// @param user 用户地址。
    /// @param limit 最多返回条数。
    /// @return rows 最新市场行数组。
    /// @return totalCount 市场总数。
    function getDashboardLatest(address user, uint256 limit)
        external
        view
        returns (DashboardRow[] memory rows, uint256 totalCount)
    {
        totalCount = marketCount;

        uint256 count = limit;
        if (count > totalCount) count = totalCount;

        rows = new DashboardRow[](count);
        for (uint256 i = 0; i < count; i++) {
            rows[i] = _dashboardRow(totalCount - 1 - i, user);
        }
    }

    function _dashboardRow(uint256 id, address user) internal view returns (DashboardRow memory row) {
        bool claimed_ = claimed[id][user];
        row = DashboardRow({
            id: id,
            market: _markets[id],
            userOutcomeStakes: _userStakeVector(id, user),
            claimed_: claimed_,
            pendingPayout: claimed_ ? 0 : _quotePayout(id, user)
        });
    }

    function _quotePayout(uint256 id, address user) internal view returns (uint256) {
        EventMarketDef storage m = _markets[id];
        if (m.settledOutcome == UNRESOLVED_OUTCOME) return 0;

        if (m.settledOutcome == INVALID_OUTCOME) {
            return _userTotalStake(id, user, m.outcomeCount);
        }

        uint128 winnerStake = stakeByOutcome[id][user][m.settledOutcome];
        if (winnerStake == 0) return 0;

        return uint256(winnerStake) * m.winnerPool / m.outcomePools[m.settledOutcome];
    }

    function _userStakeVector(uint256 id, address user) internal view returns (uint128[] memory stakes) {
        EventMarketDef storage m = _markets[id];
        stakes = new uint128[](m.outcomeCount);
        for (uint8 i = 0; i < m.outcomeCount; i++) {
            stakes[i] = stakeByOutcome[id][user][i];
        }
    }

    function _userTotalStake(uint256 id, address user, uint8 outcomeCount) internal view returns (uint256 totalStake) {
        for (uint8 i = 0; i < outcomeCount; i++) {
            totalStake += stakeByOutcome[id][user][i];
        }
    }

    function _sumPools(uint128[] storage pools) internal view returns (uint128 totalPool) {
        for (uint256 i = 0; i < pools.length; i++) {
            totalPool += pools[i];
        }
    }

    function _requireValidMarketId(uint256 id) internal view {
        if (id >= marketCount) revert InvalidMarketId();
    }
}
