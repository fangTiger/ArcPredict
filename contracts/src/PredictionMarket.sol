// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPyth, PythStructs} from "./interfaces/IPyth.sol";

/// @title ArcPredict 预测市场合约
/// @notice 当前 task 仅提供状态骨架、事件、错误和构造函数
contract PredictionMarket is Ownable2Step {
    using SafeERC20 for IERC20;

    address private constant OWNABLE_INIT_SENTINEL = address(1);

    // ============ 常量 ============
    uint256 public constant MAX_MARKETS = 1000;
    uint128 public constant MIN_BET = 1e5;
    uint16 public constant MAX_FEE_BPS = 500;
    uint64 public constant ORACLE_WINDOW = 5 minutes;
    uint64 public constant FORCE_INVALID_DELAY = 7 days;
    uint256 public constant MAX_QUESTION_LEN = 200;

    enum Outcome {
        Unresolved,
        Yes,
        No,
        Invalid
    }

    struct Market {
        bytes32 pythPriceId;
        int64 threshold;
        int32 thresholdExpo;
        uint64 betDeadline;
        uint64 resolveAfter;
        uint128 yesPool;
        uint128 noPool;
        uint128 winnerPool;
        uint128 protocolFee;
        uint16 feeBpsSnapshot;
        address feeRecipientSnapshot;
        Outcome outcome;
        int64 settlePrice;
        uint64 settleTime;
        string question;
    }

    // ============ 存储 ============
    mapping(uint256 => Market) private _markets;
    mapping(uint256 => mapping(address => uint128)) public yesStake;
    mapping(uint256 => mapping(address => uint128)) public noStake;
    mapping(uint256 => mapping(address => bool)) public claimed;
    uint256 public marketCount;

    address public feeRecipient;
    uint16 public feeBps = 100;
    address public immutable USDC;
    address public immutable PYTH;

    // ============ 事件 ============
    event MarketCreated(
        uint256 indexed id,
        bytes32 indexed pythPriceId,
        int64 threshold,
        int32 thresholdExpo,
        uint64 betDeadline,
        uint64 resolveAfter,
        uint16 feeBpsSnapshot,
        address feeRecipientSnapshot,
        string question
    );

    event Bet(
        uint256 indexed id,
        address indexed user,
        bool yes,
        uint128 amount,
        uint128 yesPoolAfter,
        uint128 noPoolAfter
    );

    event Resolved(
        uint256 indexed id,
        Outcome outcome,
        int64 settlePrice,
        uint64 settleTime,
        uint128 winnerPool,
        uint128 protocolFee
    );

    event Claimed(uint256 indexed id, address indexed user, uint256 payout);

    // ============ 错误 ============
    error MarketLimitReached();
    error InvalidTimeOrder();
    error TimesInPast();
    error ZeroAddress();
    error FeeTooHigh();
    error QuestionTooLong();
    error InvalidPriceId();
    error BettingClosed();
    error BelowMinBet();
    error AlreadyResolved();
    error NotResolvableYet();
    error InsufficientPythFee();
    error InvalidOracleUpdate();
    error NotForceInvalidatableYet();
    error NotResolved();
    error AlreadyClaimed();
    error NotAWinner();
    error NoPayoutAvailable();
    error InvalidMarketId();
    error RefundFailed();

    // 用非零占位值绕过 Ownable 构造前置校验，统一在本构造函数体内抛 ZeroAddress。
    constructor(address usdc, address pyth, address initialOwner, address initialFeeRecipient)
        Ownable(initialOwner == address(0) ? OWNABLE_INIT_SENTINEL : initialOwner)
    {
        if (
            usdc == address(0) || pyth == address(0) || initialOwner == address(0)
                || initialFeeRecipient == address(0)
        ) revert ZeroAddress();

        USDC = usdc;
        PYTH = pyth;
        feeRecipient = initialFeeRecipient;
    }

    function createMarket(
        bytes32 pythPriceId,
        int64 threshold,
        int32 thresholdExpo,
        uint64 betDeadline,
        uint64 resolveAfter,
        string calldata question
    ) external onlyOwner returns (uint256 id) {
        if (marketCount >= MAX_MARKETS) revert MarketLimitReached();
        if (betDeadline <= block.timestamp) revert TimesInPast();
        if (resolveAfter <= betDeadline) revert InvalidTimeOrder();
        if (bytes(question).length > MAX_QUESTION_LEN) revert QuestionTooLong();
        if (pythPriceId == bytes32(0)) revert InvalidPriceId();

        id = marketCount++;
        Market storage m = _markets[id];
        m.pythPriceId = pythPriceId;
        m.threshold = threshold;
        m.thresholdExpo = thresholdExpo;
        m.betDeadline = betDeadline;
        m.resolveAfter = resolveAfter;
        m.feeBpsSnapshot = feeBps;
        m.feeRecipientSnapshot = feeRecipient;
        m.question = question;

        emit MarketCreated(
            id,
            pythPriceId,
            threshold,
            thresholdExpo,
            betDeadline,
            resolveAfter,
            m.feeBpsSnapshot,
            m.feeRecipientSnapshot,
            question
        );
    }

    function setFeeBps(uint16 bps) external onlyOwner {
        if (bps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = bps;
    }

    function setFeeRecipient(address r) external onlyOwner {
        if (r == address(0)) revert ZeroAddress();
        feeRecipient = r;
    }

    function markets(uint256 id)
        external
        view
        returns (
            bytes32 pythPriceId,
            int64 threshold,
            int32 thresholdExpo,
            uint64 betDeadline,
            uint64 resolveAfter,
            uint128 yesPool,
            uint128 noPool,
            uint128 winnerPool,
            uint128 protocolFee,
            uint16 feeBpsSnapshot,
            address feeRecipientSnapshot,
            Outcome outcome,
            int64 settlePrice,
            uint64 settleTime,
            string memory question
        )
    {
        if (id >= marketCount) revert InvalidMarketId();

        Market storage m = _markets[id];
        return (
            m.pythPriceId,
            m.threshold,
            m.thresholdExpo,
            m.betDeadline,
            m.resolveAfter,
            m.yesPool,
            m.noPool,
            m.winnerPool,
            m.protocolFee,
            m.feeBpsSnapshot,
            m.feeRecipientSnapshot,
            m.outcome,
            m.settlePrice,
            m.settleTime,
            m.question
        );
    }

    function getMarket(uint256 id) external view returns (Market memory) {
        if (id >= marketCount) revert InvalidMarketId();
        return _markets[id];
    }

    function bet(uint256 id, bool yes, uint128 amount) external {
        if (id >= marketCount) revert InvalidMarketId();

        Market storage m = _markets[id];
        if (m.outcome != Outcome.Unresolved) revert AlreadyResolved();
        if (block.timestamp >= m.betDeadline) revert BettingClosed();
        if (amount < MIN_BET) revert BelowMinBet();

        IERC20(USDC).safeTransferFrom(msg.sender, address(this), amount);

        if (yes) {
            m.yesPool += amount;
            yesStake[id][msg.sender] += amount;
        } else {
            m.noPool += amount;
            noStake[id][msg.sender] += amount;
        }

        emit Bet(id, msg.sender, yes, amount, m.yesPool, m.noPool);
    }

    function resolve(uint256 id, bytes[] calldata updateData) external payable {
        if (id >= marketCount) revert InvalidMarketId();

        Market storage m = _markets[id];
        if (m.outcome != Outcome.Unresolved) revert AlreadyResolved();
        if (block.timestamp < m.resolveAfter) revert NotResolvableYet();

        uint256 fee = IPyth(PYTH).getUpdateFee(updateData);
        if (msg.value < fee) revert InsufficientPythFee();

        bytes32[] memory ids = new bytes32[](1);
        ids[0] = m.pythPriceId;

        PythStructs.PriceFeed[] memory feeds = IPyth(PYTH).parsePriceFeedUpdatesUnique{value: fee}(
            updateData, ids, m.resolveAfter, m.resolveAfter + ORACLE_WINDOW
        );
        PythStructs.Price memory p = feeds[0].price;

        bool isInvalid;
        if (p.price <= 0) {
            isInvalid = true;
        } else if (p.expo != m.thresholdExpo) {
            isInvalid = true;
        } else if (m.yesPool + m.noPool == 0) {
            isInvalid = true;
        }

        Outcome outcome;
        uint128 winningPool;
        uint128 losingPool;

        if (!isInvalid) {
            outcome = p.price >= m.threshold ? Outcome.Yes : Outcome.No;
            winningPool = outcome == Outcome.Yes ? m.yesPool : m.noPool;
            losingPool = outcome == Outcome.Yes ? m.noPool : m.yesPool;

            if (winningPool == 0) {
                isInvalid = true;
                outcome = Outcome.Invalid;
            }
        }

        if (isInvalid) {
            outcome = Outcome.Invalid;
        }

        m.outcome = outcome;

        if (outcome != Outcome.Invalid) {
            m.settlePrice = p.price;
            m.settleTime = uint64(p.publishTime);
            m.protocolFee = uint128(uint256(losingPool) * m.feeBpsSnapshot / 10_000);
            m.winnerPool = winningPool + losingPool - m.protocolFee;

            if (m.protocolFee > 0) {
                IERC20(USDC).safeTransfer(m.feeRecipientSnapshot, m.protocolFee);
            }
        }

        emit Resolved(id, m.outcome, m.settlePrice, m.settleTime, m.winnerPool, m.protocolFee);

        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            if (!ok) revert RefundFailed();
        }
    }

    function forceInvalid(uint256 id) external {
        if (id >= marketCount) revert InvalidMarketId();

        Market storage m = _markets[id];
        if (m.outcome != Outcome.Unresolved) revert AlreadyResolved();
        if (block.timestamp < m.resolveAfter + FORCE_INVALID_DELAY) revert NotForceInvalidatableYet();

        m.outcome = Outcome.Invalid;

        emit Resolved(id, Outcome.Invalid, 0, 0, 0, 0);
    }

    function _quotePayout(uint256 id, address user) internal view returns (uint256) {
        Market storage m = _markets[id];
        if (m.outcome == Outcome.Unresolved) return 0;

        uint128 yesAmount = yesStake[id][user];
        uint128 noAmount = noStake[id][user];

        if (m.outcome == Outcome.Invalid) {
            return uint256(yesAmount) + uint256(noAmount);
        }

        if (m.outcome == Outcome.Yes) {
            if (yesAmount == 0) return 0;
            return uint256(yesAmount) * m.winnerPool / m.yesPool;
        }

        if (noAmount == 0) return 0;
        return uint256(noAmount) * m.winnerPool / m.noPool;
    }

    function claim(uint256 id) external {
        if (id >= marketCount) revert InvalidMarketId();

        Market storage m = _markets[id];
        if (m.outcome == Outcome.Unresolved) revert NotResolved();
        if (claimed[id][msg.sender]) revert AlreadyClaimed();

        uint128 yesAmount = yesStake[id][msg.sender];
        uint128 noAmount = noStake[id][msg.sender];
        uint256 totalStake = uint256(yesAmount) + uint256(noAmount);

        if (totalStake == 0) revert NoPayoutAvailable();
        if (m.outcome == Outcome.Yes && yesAmount == 0) revert NotAWinner();
        if (m.outcome == Outcome.No && noAmount == 0) revert NotAWinner();

        uint256 payout = _quotePayout(id, msg.sender);

        claimed[id][msg.sender] = true;
        IERC20(USDC).safeTransfer(msg.sender, payout);

        emit Claimed(id, msg.sender, payout);
    }

    function userStake(uint256 id, address u) external view returns (uint128 yes_, uint128 no_) {
        if (id >= marketCount) revert InvalidMarketId();

        yes_ = yesStake[id][u];
        no_ = noStake[id][u];
    }

    function pendingPayout(uint256 id, address u) external view returns (uint256) {
        if (id >= marketCount) revert InvalidMarketId();
        if (claimed[id][u]) return 0;
        return _quotePayout(id, u);
    }
}
