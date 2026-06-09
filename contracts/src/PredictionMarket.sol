// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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
    mapping(uint256 => Market) public markets;
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
}
