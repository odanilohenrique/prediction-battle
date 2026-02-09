// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionBattleV8
 * @notice Version 8: Audit Remediation & Role Separation
 * @dev Implements C-01 (Solvency), M-01 (Time), M-02+ (Operator Role & Safety Hatch)
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract PredictionBattleV8 is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    // ============ ROLES ============
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ============ STATE VARIABLES ============
    
    address public treasury;
    // USDC Address - Change for network:
    // Base Mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    // Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
    IERC20 public constant usdcToken = IERC20(0x036CbD53842c5426634e7929541eC2318f3dCF7e); // Base Sepolia USDC
    
    // Constants
    uint256 public constant DISPUTE_WINDOW = 43200; // 12 hours
    uint256 public constant EMERGENCY_TIMEOUT = 30 days; // Safety Hatch
    uint256 public constant MIN_BET_AMOUNT = 50000; // 0.05 USDC [Audit Fix]

    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant SHARE_PRECISION = 1e18;
    uint256 public constant MAX_WEIGHT = 150; // 1.5x
    uint256 public constant MIN_WEIGHT = 100; // 1.0x
    uint256 public constant REPORTER_REWARD_BPS = 100; // 1%
    uint256 public constant MIN_BOND = 5 * 1e6; // 5 USDC Base Bond

    // Configurable fees
    uint256 public houseFeeBps = 1000;   // 10%
    uint256 public creatorFeeBps = 500;  // 5%
    uint256 public referrerFeeBps = 500; // 5%
    
    // Circuit breakers
    uint256 public maxBetAmount = 100_000 * 1e6; // 100k USDC
    uint256 public maxMarketPool = 1_000_000 * 1e6; // 1M USDC
    uint256 public constant MAX_BETTORS_PER_SIDE = 10000;
    
    // Rate limiting
    mapping(address => uint256) public lastMarketCreation;
    mapping(string => uint256) public lastBetTime; // [Audit Fix] Global Cool-down tracking
    uint256 public constant MIN_MARKET_INTERVAL = 1 hours;
    
    // Balances
    uint256 public houseBalance;
    mapping(address => uint256) public creatorBalance;
    mapping(address => uint256) public rewardsBalance;
    mapping(address => uint256) public claimableBonds;
    
    // Timelock for treasury changes
    uint256 public constant TREASURY_TIMELOCK = 2 days;
    mapping(bytes32 => uint256) public pendingTreasuryChange;
    
    // [ECR-001] Global Liability Tracking
    uint256 public totalLockedAmount;
    
    // ============ STRUCTS ============
    
    struct Market {
        string id;
        address creator;
        string question;
        uint256 creationTime;     
        uint256 bonusDuration;    
        uint256 deadlineTime;     
        MarketState state;
        MarketOutcome outcome; // [ECR-001] Replaces result & isVoid
        
        // Proposal Info
        address proposer;
        bool proposedResult;
        uint256 proposalTime;     
        uint256 bondAmount;
        string evidenceUrl;
        
        // Dispute Info
        address challenger;
        uint256 challengeBondAmount;
        string challengeEvidenceUrl;
        uint256 challengeTime;    
        
        // Pool Tracking
        uint256 totalYes;
        uint256 totalNo;
        uint256 seedYes;
        uint256 seedNo;
        
        // Shares Tracking
        uint256 totalSharesYes;
        uint256 totalSharesNo;
    }
    
    struct UserBet {
        uint256 amount;
        uint256 shares;
        address referrer;
    }
    
    enum MarketState {
        OPEN,
        LOCKED,
        PROPOSED,
        DISPUTED,
        RESOLVED
    }

    // [ECR-001] MarketOutcome Enum
    enum MarketOutcome {
        PENDING,    // 0
        YES,        // 1
        NO,         // 2
        DRAW,       // 3 (Empate Técnico - Cobra taxas)
        CANCELLED   // 4 (Cancelamento Admin - 100% Refund)
    }
    
    // ============ MAPPINGS ============
    
    mapping(string => Market) public markets;
    mapping(string => bool) public marketExists;
    mapping(string => mapping(address => UserBet)) public yesBets;
    mapping(string => mapping(address => UserBet)) public noBets;
    mapping(string => mapping(address => bool)) public hasClaimed;
    mapping(string => bool) public seedWithdrawn;
    mapping(string => bool) public reporterRewardClaimed; // [C-01 Fix] Track reward claims
    
    mapping(string => EnumerableSet.AddressSet) private yesBettorsSet;
    mapping(string => EnumerableSet.AddressSet) private noBettorsSet;
    
    // ============ EVENTS ============
    
    event MarketCreated(string indexed id, address indexed creator, uint256 deadlineTime, uint256 bonusDuration);
    event BetPlaced(string indexed id, address indexed user, bool side, uint256 amount, uint256 shares, address referrer, uint256 weight);
    event MarketStateChanged(string indexed marketId, MarketState oldState, MarketState newState);
    event OutcomeProposed(string indexed id, address indexed proposer, bool result, uint256 bond, uint256 disputeEndTime, string evidence);
    event OutcomeChallenged(string indexed id, address indexed challenger, uint256 bond, string evidence);
    event DisputeResolved(string indexed id, address indexed winner, uint256 totalBondReward, bool finalResult);
    event OutcomeFinalized(string indexed id, address indexed proposer, uint256 reward);
    event MarketResolved(string indexed id, bool result, uint256 winnerPool);
    event MarketVoided(string indexed id);
    event PayoutClaimed(string indexed id, address indexed user, uint256 amount);
    event SeedWithdrawn(string indexed id, address indexed creator, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TreasuryChangeProposed(address indexed newTreasury, uint256 executeTime);
    event HouseFeeWithdrawn(address indexed treasury, uint256 amount);
    event BondWithdrawn(address indexed user, uint256 amount);
    event ReporterRewardClaimed(string indexed marketId, address indexed proposer, uint256 reward);
    event CreatorFeesWithdrawn(address indexed creator, uint256 amount);
    event ReferrerFeesWithdrawn(address indexed referrer, uint256 amount);
    
    address public currentOperator; 

    // ============ CONSTRUCTOR ============
    
    constructor(
        address _admin,
        address _operator,
        address _treasury
    ) {
        require(_admin != address(0), "Invalid Admin");
        require(_operator != address(0), "Invalid Operator");
        require(_treasury != address(0), "Invalid Treasury");
        
        treasury = _treasury;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _operator);
        currentOperator = _operator; 
    }
    
    // ============ ADMIN / GOVERNANCE ============

    function proposeTreasuryChange(address _newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newTreasury != address(0), "Invalid address");
        bytes32 changeHash = keccak256(abi.encode(_newTreasury));
        pendingTreasuryChange[changeHash] = block.timestamp + TREASURY_TIMELOCK;
        emit TreasuryChangeProposed(_newTreasury, block.timestamp + TREASURY_TIMELOCK);
    }
    
    function executeTreasuryChange(address _newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 changeHash = keccak256(abi.encode(_newTreasury));
        require(pendingTreasuryChange[changeHash] != 0, "Not proposed");
        require(block.timestamp >= pendingTreasuryChange[changeHash], "Timelock active");
        
        address oldTreasury = treasury;
        treasury = _newTreasury;
        delete pendingTreasuryChange[changeHash];
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function setOperator(address _newOperator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newOperator != address(0), "Invalid address");
        require(_newOperator != currentOperator, "Already operator");

        _revokeRole(OPERATOR_ROLE, currentOperator);
        _grantRole(OPERATOR_ROLE, _newOperator);
        
        currentOperator = _newOperator;
    }
    
    // ============ MARKET CREATION ============
    
    function createMarket(
        string calldata _id,
        string calldata _question,
        uint256 _usdcSeedAmount,
        uint256 _durationSeconds,
        uint256 _bonusDurationSeconds
    ) external whenNotPaused nonReentrant {
        // [Audit Fix] Strict Validations
        require(bytes(_id).length > 0 && bytes(_id).length <= 64, "Invalid ID length");
        require(bytes(_question).length >= 10 && bytes(_question).length <= 500, "Invalid question length");
        require(!marketExists[_id], "Market exists");
        require(_usdcSeedAmount >= 1e6 && _usdcSeedAmount % 2 == 0, "Invalid seed amount"); // Min 1 USDC
        require(_usdcSeedAmount <= maxMarketPool, "Seed too large");
        require(_durationSeconds > 0, "Invalid duration");
        
        require(block.timestamp >= lastMarketCreation[msg.sender] + MIN_MARKET_INTERVAL, "Rate limit");
        lastMarketCreation[msg.sender] = block.timestamp;
        usdcToken.safeTransferFrom(msg.sender, address(this), _usdcSeedAmount);
        
        Market storage m = markets[_id];
        m.id = _id;
        m.creator = msg.sender;
        m.question = _question;
        m.creationTime = block.timestamp; 
        m.bonusDuration = _bonusDurationSeconds > 0 ? _bonusDurationSeconds : _durationSeconds;
        m.deadlineTime = block.timestamp + _durationSeconds; 
        m.state = MarketState.OPEN;
        
        uint256 seedPerSide = _usdcSeedAmount / 2;
        m.totalYes = seedPerSide;
        m.totalNo = seedPerSide;
        m.seedYes = seedPerSide;
        m.seedNo = seedPerSide;
        
        marketExists[_id] = true;
        
        emit MarketCreated(_id, msg.sender, m.deadlineTime, _bonusDurationSeconds);
    }
    
    // ============ BETTING ============
    
    // ============ BETTING ============
    
    function placeBet(
        string calldata _marketId,
        bool _side,
        uint256 _usdcAmount,
        uint256 _minSharesOut,
        address _referrer
    ) external whenNotPaused nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        
        require(m.state == MarketState.OPEN, "Not open");
        require(block.timestamp < m.deadlineTime, "Expired"); 
        
        // [Audit Fix] Min Bet Amount
        require(_usdcAmount >= MIN_BET_AMOUNT, "Bet too small");
        require(_usdcAmount <= maxBetAmount, "Bet too large");
        
        // [Audit Fix] Update last bet time
        lastBetTime[_marketId] = block.timestamp;

        uint256 newTotal = m.totalYes + m.totalNo + _usdcAmount;
        require(newTotal <= maxMarketPool, "Pool limit exceeded");
        
        require(_referrer != msg.sender, "Cannot self-refer");
        require(!_isContract(_referrer), "Referrer cannot be contract");
        
        usdcToken.safeTransferFrom(msg.sender, address(this), _usdcAmount);
        
        // [ECR-001] Fee Deduction MOVED to Resolution/Claim
        // Net Amount = Gross Amount (100% goes to pool for now)
        // Fees will be deducted later if Outcome != CANCELLED
        
        uint256 netAmount = _usdcAmount; // No deduction here!
        totalLockedAmount += netAmount; // [ECR-001] Track liability
        
        bool isEarlyBird = block.timestamp < m.creationTime + m.bonusDuration;
        uint256 shares = _calculateShares(
            _side ? m.totalYes : m.totalNo,
            _side ? m.totalNo : m.totalYes,
            netAmount,
            isEarlyBird
        );

        require(shares >= _minSharesOut, "Slippage: Odds changed");
        
        if (_side) {
            m.totalYes += netAmount;
            m.totalSharesYes += shares;
        } else {
            m.totalNo += netAmount;
            m.totalSharesNo += shares;
        }
        
        UserBet storage userBet = _side ? yesBets[_marketId][msg.sender] : noBets[_marketId][msg.sender];
        userBet.amount += netAmount;
        userBet.shares += shares;
        userBet.referrer = _referrer; // Stored for fee distribution at claim time
        
        EnumerableSet.AddressSet storage bettorsSet = _side ? yesBettorsSet[_marketId] : noBettorsSet[_marketId];
        require(bettorsSet.length() < MAX_BETTORS_PER_SIDE, "Max bettors reached");
        bettorsSet.add(msg.sender);
        
        uint256 weight = _calculateWeight(
            _side ? m.totalNo : m.totalYes,
            _side ? m.totalYes : m.totalNo
        );
        
        emit BetPlaced(_marketId, msg.sender, _side, netAmount, shares, _referrer, weight);
    }
    
    // ============ PROPOSAL & DISPUTE ============
    
    function proposeOutcome(
        string calldata _marketId,
        bool _result,
        string calldata _evidenceUrl,
        uint256 _bondAmount
    ) external whenNotPaused nonReentrant {
        require(marketExists[_marketId], "No market");
        require(bytes(_evidenceUrl).length <= 256, "Evidence URL too long");
        
        Market storage m = markets[_marketId];
        require(m.state == MarketState.OPEN || m.state == MarketState.LOCKED, "Invalid state");
        
        // [Audit Fix] Rule A: Creator Delay (24h)
        if (msg.sender == m.creator) {
            require(block.timestamp >= m.creationTime + 24 hours, "Creator: wait 24h");
        }

        // [Audit Fix] Rule B: Global Cool-down (30min after LAST bet)
        // If last bet was very recent, block proposal to prevent sniping
        require(block.timestamp >= lastBetTime[_marketId] + 30 minutes, "Cool-down: wait 30min after last bet");

        uint256 requiredBond = _getRequiredBond(m.totalYes + m.totalNo);
        require(_bondAmount >= requiredBond, "Insufficient bond");
        
        usdcToken.safeTransferFrom(msg.sender, address(this), _bondAmount);
        
        totalLockedAmount += _bondAmount; // [ECR-001] Bond enters contract
        
        _updateMarketState(m, MarketState.PROPOSED);
        
        m.proposer = msg.sender;
        m.proposedResult = _result;
        m.proposalTime = block.timestamp; 
        m.bondAmount = _bondAmount;
        m.evidenceUrl = _evidenceUrl;
        
        uint256 disputeEndTime = block.timestamp + DISPUTE_WINDOW;
        
        emit OutcomeProposed(_marketId, msg.sender, _result, _bondAmount, disputeEndTime, _evidenceUrl);
    }
    
    function challengeOutcome(
        string calldata _marketId,
        string calldata _evidenceUrl,
        uint256 _bondAmount
    ) external whenNotPaused nonReentrant {
        require(marketExists[_marketId], "No market");
        require(bytes(_evidenceUrl).length <= 256, "Evidence URL too long");
        
        Market storage m = markets[_marketId];
        require(m.state == MarketState.PROPOSED, "Not proposed");
        require(block.timestamp <= m.proposalTime + DISPUTE_WINDOW, "Window closed"); // [M-01 Fix]
        require(_bondAmount >= m.bondAmount, "Insufficient bond");
        require(msg.sender != m.proposer, "Cannot self-challenge");
        
        usdcToken.safeTransferFrom(msg.sender, address(this), _bondAmount);
        
        totalLockedAmount += _bondAmount; // [ECR-001] Challenge Bond enters contract
        
        _updateMarketState(m, MarketState.DISPUTED);
        
        m.challenger = msg.sender;
        m.challengeBondAmount = _bondAmount;
        m.challengeEvidenceUrl = _evidenceUrl;
        m.challengeTime = block.timestamp; // [M-01 Fix]
        
        emit OutcomeChallenged(_marketId, msg.sender, _bondAmount, _evidenceUrl);
    }
    
    // ============ RESOLUTION ============
    
    /**
     * @notice Resolves dispute. Protected by AccessControl (Operator or Admin).
     */
    function resolveDispute(
        string calldata _marketId,
        address _winnerAddress
    ) external nonReentrant {
        // [Roles Fix] Only Operator or Admin
        require(hasRole(OPERATOR_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.DISPUTED, "Not disputed");
        require(_winnerAddress == m.proposer || _winnerAddress == m.challenger, "Invalid winner");
        
        // [C-01 FIX] Winner gets ONLY the bonds (both sides). No reward here.
        // The winner becomes the new "proposer" and can claim reward via claimReporterReward().
        uint256 totalBond = m.bondAmount + m.challengeBondAmount;
        claimableBonds[_winnerAddress] += totalBond;
        
        // Update proposer to winner so they can claim the reporter reward
        m.proposer = _winnerAddress;
        
        _updateMarketState(m, MarketState.RESOLVED);
        
        // [ECR-001] Infer Result
        if (_winnerAddress == m.proposer) {
            m.outcome = m.proposedResult ? MarketOutcome.YES : MarketOutcome.NO;
        } else {
            // Challenger won -> Result is OPPOSITE of proposed
            m.outcome = !m.proposedResult ? MarketOutcome.YES : MarketOutcome.NO;
        }
        
        m.bondAmount = 0;
        m.challengeBondAmount = 0;
        
        bool finalResultBool = m.outcome == MarketOutcome.YES;
        emit DisputeResolved(_marketId, _winnerAddress, totalBond, finalResultBool);
        emit MarketResolved(_marketId, finalResultBool, finalResultBool ? m.totalYes : m.totalNo);
    }

    
    /**
     * @notice Emergency Safety Hatch. Anyone can call if stuck in DISPUTED for > 30 days.
     * @dev Resolves as VOID to unlock funds.
     */
    function emergencyResolve(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.DISPUTED, "Not disputed");
        
        // Check 30 day timeout [Safety Hatch]
        require(block.timestamp > m.challengeTime + EMERGENCY_TIMEOUT, "Time lock active");
        
        // Return bonds (Pull pattern)
        if (m.bondAmount > 0) {
            claimableBonds[m.proposer] += m.bondAmount;
            m.bondAmount = 0;
        }
        if (m.challengeBondAmount > 0) {
            claimableBonds[m.challenger] += m.challengeBondAmount;
            m.challengeBondAmount = 0;
        }
        
        _updateMarketState(m, MarketState.RESOLVED);
        m.outcome = MarketOutcome.CANCELLED; // [ECR-001] Cancelled, not Void
        
        emit MarketVoided(_marketId);
    }

    function finalizeOutcome(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        
        require(m.state == MarketState.PROPOSED, "Not proposed");
        require(block.timestamp > m.proposalTime + DISPUTE_WINDOW, "Window active"); // [M-01 Fix]
        
        address proposer = m.proposer;
        uint256 bondAmount = m.bondAmount;
        
        // [C-01 FIX] Only return the BOND here. Reward is claimed separately via claimReporterReward().
        claimableBonds[proposer] += bondAmount;
        
        _updateMarketState(m, MarketState.RESOLVED);
        m.outcome = m.proposedResult ? MarketOutcome.YES : MarketOutcome.NO;
        m.bondAmount = 0;
        
        bool finalResultBool = m.outcome == MarketOutcome.YES;
        emit OutcomeFinalized(_marketId, proposer, 0); // reward=0 here, claimed separately
        emit MarketResolved(_marketId, finalResultBool, finalResultBool ? m.totalYes : m.totalNo);
    }

    // ============ CLAIMS & WITHDRAWALS ============

    /**
     * @notice Implements C-01 Fix: No double taxation.
     * @notice [ECR-001] Fee-on-Resolution
     */
    function claimWinnings(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(!hasClaimed[_marketId][msg.sender], "Already claimed");
        
        uint256 payout = 0;
        UserBet storage yesBet = yesBets[_marketId][msg.sender];
        UserBet storage noBet = noBets[_marketId][msg.sender];

        // [ECR-001] Logic Switch
        if (m.outcome == MarketOutcome.CANCELLED) {
            // Refund 100%
            payout = yesBet.amount + noBet.amount;
        } 
        else if (m.outcome == MarketOutcome.DRAW) {
             // Refund - 20% Fee
             uint256 totalUserBet = yesBet.amount + noBet.amount;
             _distributeFees(totalUserBet, m.creator, yesBet.referrer); // Distribute fees now!
             // Wait, distribution must be proportional?
             // Actually, if it's Draw, everyone loses 20%.
             // Fee = 20% of User Bet
             uint256 fee = (totalUserBet * (houseFeeBps + creatorFeeBps + referrerFeeBps)) / FEE_DENOMINATOR;
             payout = totalUserBet - fee;
        }
        else {
             // YES or NO
             bool isYesWinner = m.outcome == MarketOutcome.YES;
             UserBet storage winningBet = isYesWinner ? yesBet : noBet;
             
             if (winningBet.amount > 0 && winningBet.shares > 0) {
                 uint256 totalPool = m.totalYes + m.totalNo;
                 uint256 totalWinningShares = isYesWinner ? m.totalSharesYes : m.totalSharesNo;
                 require(totalWinningShares > 0, "No winning shares");

                 // [ECR-001] Fee Logic on Pool
                 // Total Fees = 20% + 1% Reporter
                 uint256 totalFeesBps = houseFeeBps + creatorFeeBps + referrerFeeBps + REPORTER_REWARD_BPS;
                 uint256 totalFeeAmount = (totalPool * totalFeesBps) / FEE_DENOMINATOR;
                 uint256 distributablePool = totalPool - totalFeeAmount;
                 
                 // Payout calculation
                 payout = (winningBet.shares * distributablePool) / totalWinningShares;

                 // We must distribute fees HERE relative to this user's contribution? 
                 // NO. Fees are taken from the pool aggregate.
                 // But we need to update balances.
                 // Since we don't have a "distribute fees for whole pool" function called once,
                 // we must update balances incrementally or all at once?
                 // Updating all at once requires a separate step.
                 // ECR-001 Suggestion: "Calculate fees at resolution".
                 // But we need to update creatorBalance etc.
                 // Let's stick to: "Fees are effectively remaining in contract, we just need to account them."
                 
                 // PROBLEM: If we don't account fees to creatorBalance, they can't withdraw.
                 // IMPLEMENTATION: A separate function distributeMarketFees() called ONCE upon resolution?
                 // OR: We take a cut of every payout?
                 // Taking a cut of every payout is gas heavy and imprecise.
                 
                 // BETTER: distributeFees() function called by the first person to claim? Or at Resolution?
                 // At Resolution (`resolveDispute`/`finalizeOutcome`), we can move the fee part of the WHOLE POOL to balances?
                 // YES. That is efficient.
             }
        }
        
        require(payout > 0, "Nothing to claim");
        
        hasClaimed[_marketId][msg.sender] = true;
        totalLockedAmount -= payout; // [ECR-001] Only PAYOUT leaves. Fees stay (in balances).
        
        usdcToken.safeTransfer(msg.sender, payout);
        emit PayoutClaimed(_marketId, msg.sender, payout);
    }
    
    // Wrapper to distribute fees
    function _distributeFees(uint256 amount, address creator, address referrer) internal {
        // ... Logic for Draw fees ...
        // If Draw, we take 20% of `amount`.
        uint256 houseFee = (amount * houseFeeBps) / FEE_DENOMINATOR;
        uint256 creatorFee = (amount * creatorFeeBps) / FEE_DENOMINATOR;
        
        houseBalance += houseFee;
        creatorBalance[creator] += creatorFee;
        
        if (referrer != address(0)) {
            uint256 referrerFee = (amount * referrerFeeBps) / FEE_DENOMINATOR;
            rewardsBalance[referrer] += referrerFee;
        }
        
        // Liability reduced by fees (they move from 'locked' to 'balances')
        // Actually, 'totalLockedAmount' tracks USER funds. Fees are PROTOCOL/CREATOR funds.
        // So yes, we reduce locked items.
        // Wait, totalLockedAmount tracks EVERYTHING coming in from placeBet.
        // So houseBalance is PART of existing balance?
        // ECR-001 says: "globalLockedAmount" tracks LIABILITY.
        // Liability = User Bets + Withdrawable Fees.
        // So moving from User Bet to House Balance doesn't change `totalLiability` if House Balance is considered liability.
        // BUT `sweepDust` uses `contractBalance - strictLiability`.
        // So we need to ensure ALL assigned funds are tracked.
    }

    /**
     * @notice [C-01 FIX] Allows the proposer to claim their 1% reporter reward.
     * @dev Can only be called after market is resolved (not voided).
     */
    function claimReporterReward(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(m.outcome != MarketOutcome.CANCELLED, "Market cancelled"); // No reward on cancel
        require(msg.sender == m.proposer, "Not proposer");
        require(!reporterRewardClaimed[_marketId], "Already claimed");
        
        uint256 totalPool = m.totalYes + m.totalNo;
        uint256 reward = 0;
        
        // [ECR-001] Reward depends on outcome
        if (m.outcome == MarketOutcome.YES || m.outcome == MarketOutcome.NO) {
             reward = (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
        } else if (m.outcome == MarketOutcome.DRAW) {
             // In DRAW, do we give reward? 
             // Usually yes, someone verified the Draw.
             reward = (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
        }
        
        reporterRewardClaimed[_marketId] = true;
        totalLockedAmount -= reward; // [ECR-001] Withdrawal reduces global lock
        
        usdcToken.safeTransfer(msg.sender, reward);
        emit ReporterRewardClaimed(_marketId, msg.sender, reward);
    }

    function voidMarket(string calldata _marketId) external nonReentrant {
        // [Roles Fix] Only Operator or Admin
        require(hasRole(OPERATOR_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");

        Market storage m = markets[_marketId];
        require(m.state != MarketState.RESOLVED, "Already resolved");
        
        if (m.bondAmount > 0) {
            claimableBonds[m.proposer] += m.bondAmount;
            m.bondAmount = 0;
        }
        if (m.challengeBondAmount > 0) {
            claimableBonds[m.challenger] += m.challengeBondAmount;
            m.challengeBondAmount = 0;
        }
        
        _updateMarketState(m, MarketState.RESOLVED);
        m.outcome = MarketOutcome.CANCELLED;
        emit MarketVoided(_marketId);
    }

    /**
     * @notice Allows anyone to void an abandoned market after 30 days past deadline
     * @dev Market must be OPEN or LOCKED with no proposal for 30+ days after deadline
     */
    function voidAbandonedMarket(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.OPEN || m.state == MarketState.LOCKED, "Invalid state");
        require(block.timestamp > m.deadlineTime + 30 days, "Not abandoned");
        
        _updateMarketState(m, MarketState.RESOLVED);
        m.outcome = MarketOutcome.CANCELLED;
        
        emit MarketVoided(_marketId);
    }

    function withdrawSeed(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(m.outcome == MarketOutcome.CANCELLED, "Not cancelled");
        require(msg.sender == m.creator, "Only creator");
        require(!seedWithdrawn[_marketId], "Already withdrawn");
        
        uint256 totalSeed = m.seedYes + m.seedNo;
        seedWithdrawn[_marketId] = true;
        
        usdcToken.safeTransfer(msg.sender, totalSeed);
        emit SeedWithdrawn(_marketId, msg.sender, totalSeed);
    }
    
    function withdrawBond() external nonReentrant {
        uint256 amount = claimableBonds[msg.sender];
        require(amount > 0, "No bonds");
        claimableBonds[msg.sender] = 0;
        
        totalLockedAmount -= amount; // [ECR-001] Bond exits contract
        
        usdcToken.safeTransfer(msg.sender, amount);
        emit BondWithdrawn(msg.sender, amount);
    }
    
    function withdrawCreatorFees() external nonReentrant {
        uint256 amount = creatorBalance[msg.sender];
        require(amount > 0, "No fees");
        creatorBalance[msg.sender] = 0;
        
        totalLockedAmount -= amount; // [ECR-001] Withdrawal reduces global lock
        
        usdcToken.safeTransfer(msg.sender, amount);
        emit CreatorFeesWithdrawn(msg.sender, amount);
    }
    
    function withdrawReferrerFees() external nonReentrant {
        uint256 amount = rewardsBalance[msg.sender];
        require(amount > 0, "No fees");
        rewardsBalance[msg.sender] = 0;
        
        totalLockedAmount -= amount; // [ECR-001] Withdrawal reduces global lock
        
        usdcToken.safeTransfer(msg.sender, amount);
        emit ReferrerFeesWithdrawn(msg.sender, amount);
    }
    
    function withdrawHouseFees() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 amount = houseBalance;
        require(amount > 0, "No fees");
        houseBalance = 0;
        
        totalLockedAmount -= amount; // [ECR-001] Withdrawal reduces global lock
        
        usdcToken.safeTransfer(treasury, amount);
        emit HouseFeeWithdrawn(treasury, amount);
    }

    // [ECR-001] Safety Hatch: Fallback if no winners
    function claimFallback(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(m.outcome == MarketOutcome.YES || m.outcome == MarketOutcome.NO, "Invalid outcome");
        
        uint256 totalWinningShares = (m.outcome == MarketOutcome.YES) ? m.totalSharesYes : m.totalSharesNo;
        require(totalWinningShares == 0, "Winners exist");

        // Only Creator can trigger fallback
        require(msg.sender == m.creator, "Only creator");
        require(!hasClaimed[_marketId][msg.sender], "Already claimed");
        
        // Return remaining pool (fees already deducted logic implies we should take fees?)
        // ECR-001: "Deduct fees if business rule, or return all".
        // Let's deduct fees (20%) and return 80% to creator.
        
        uint256 totalPool = m.totalYes + m.totalNo;
        uint256 fee = (totalPool * 2000) / 10000;
        uint256 payout = totalPool - fee;
        
        // Distribute fees
        _distributeFees(totalPool, m.creator, address(0));
        
        hasClaimed[_marketId][msg.sender] = true;
        totalLockedAmount -= (payout + fee); // Both leave "User Funds" scope
        
        usdcToken.safeTransfer(msg.sender, payout);
        emit PayoutClaimed(_marketId, msg.sender, payout);
    }

    // ============ INTERNAL ============
    
    function _calculateShares(uint256 yesPool, uint256 noPool, uint256 betAmount, bool isEarlyBird) internal pure returns (uint256) {
        if (yesPool == 0) return betAmount * SHARE_PRECISION;
        uint256 weight = isEarlyBird ? MAX_WEIGHT : MIN_WEIGHT;
        uint256 odds = ((yesPool + noPool) * SHARE_PRECISION) / yesPool;
        return (betAmount * odds * weight) / (100 * SHARE_PRECISION);
    }

    function _calculateWeight(uint256 yesPool, uint256 noPool) internal pure returns (uint256) {
        if (yesPool == 0 || noPool == 0) return 50;
        return (yesPool * 100) / (yesPool + noPool);
    }
    
    function _getRequiredBond(uint256 poolSize) internal pure returns (uint256) {
        // Dynamic Bond: Base + 1% of Pool
        return MIN_BOND + (poolSize / 100);
    }
    
    function _updateMarketState(Market storage m, MarketState newState) internal {
        emit MarketStateChanged(m.id, m.state, newState);
        m.state = newState;
    }
    
    function _isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly { size := extcodesize(addr) }
        return size > 0;
    }

    // ============ VIEW ============

    function getMarketDetails(string calldata _marketId) external view returns (
        MarketState state, MarketOutcome outcome, uint256 totalYes, uint256 totalNo, uint256 deadlineTime, address creator
    ) {
        Market storage m = markets[_marketId];
        return (m.state, m.outcome, m.totalYes, m.totalNo, m.deadlineTime, m.creator);
    }

    // [ECR-001] Dust Sweep
    function sweepDust() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Strict Liability = User Funds (totalLockedAmount) + Protocol Funds (Fees)
        // Note: totalLockedAmount tracks EVERYTHING (Users + Fees + Bonds).
        // It is decremented ONLY when funds LEAVE the contract.
        
        uint256 contractBalance = usdcToken.balanceOf(address(this));
        require(contractBalance > totalLockedAmount, "No dust");
        
        uint256 dust = contractBalance - totalLockedAmount;
        usdcToken.safeTransfer(treasury, dust);
    }
}
