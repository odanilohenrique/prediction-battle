// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionBattleV10
 * @notice Version 10: Deadline-Aware Markets, Fair DRAW Refunds & Corrected Bond Incentives
 * @dev Changes: Two market types (time-bound vs open-ended), 80/20 bond split,
 *      amount-based DRAW refunds, strict deadline enforcement for proposals.
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
// [GAS-OPT] Removed EnumerableSet - replaced with simple counters

contract PredictionBattleV10 is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    // ============ ROLES ============
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ============ STATE VARIABLES ============
    
    address public treasury;
    // USDC Address - Change for network:
    // Base Mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    // Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
    IERC20 public immutable usdcToken;
    
    // Constants
    uint256 public constant DISPUTE_WINDOW = 43200; // 12 hours
    uint256 public constant EMERGENCY_TIMEOUT = 30 days; // Safety Hatch
    uint256 public constant MIN_BET_AMOUNT = 50000; // 0.05 USDC

    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant SHARE_PRECISION = 1e18;
    uint256 public constant MAX_WEIGHT = 120; // 1.2x (Reduced from 1.5x)
    uint256 public constant MIN_WEIGHT = 100; // 1.0x
    uint256 public constant REPORTER_REWARD_BPS = 100; // 1%
    uint256 public constant MIN_BOND = 5 * 1e6; // 5 USDC Base Bond

    // Configurable fees (Total: 20% + 1% Reporter = 21%)
    uint256 public houseFeeBps = 1000;   // 10%
    uint256 public creatorFeeBps = 500;  // 5%
    uint256 public referrerFeeBps = 500; // 5%
    
    // Circuit breakers
    uint256 public maxBetAmount = 100_000 * 1e6; // 100k USDC
    uint256 public maxMarketPool = 1_000_000 * 1e6; // 1M USDC
    // [AUDIT-FIX] Removed MAX_BETTORS_PER_SIDE (unused)
    
    // Rate limiting
    mapping(address => uint256) public lastMarketCreation;
    mapping(string => uint256) public lastBetTime;
    // [AUDIT-FIX] Beta-04: Per-user bet time to prevent MEV without enabling griefing
    mapping(string => mapping(address => uint256)) public lastUserBetTime;
    uint256 public constant MIN_MARKET_INTERVAL = 1 hours;
    
    // Balances
    uint256 public houseBalance;
    mapping(address => uint256) public creatorBalance;
    mapping(address => uint256) public rewardsBalance;
    mapping(address => uint256) public claimableBonds;
    
    // Timelock for treasury changes
    uint256 public constant TREASURY_TIMELOCK = 2 days;
    mapping(bytes32 => uint256) public pendingTreasuryChange;
    
    // [ECR-002] Global Liability Tracking
    uint256 public totalLockedAmount;
    
    // [AUDIT-FIX] Beta-01 M-02: Nonce for ID generation
    uint256 public marketCount;
    
    // ============ STRUCTS ============
    
    struct Market {
        string id;
        address creator;
        string question;
        uint256 creationTime;     
        uint256 bonusDuration;    
        uint256 deadlineTime;     
        MarketState state;
        MarketOutcome outcome;
        
        // [ECR-002] Recoverable Seed (Separate from Pool)
        uint256 seedAmount;
        bool seedWithdrawn;
        
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
        
        // Pool Tracking (ONLY User Bets, NOT Seed)
        uint256 totalYes;
        uint256 totalNo;
        
        // Shares Tracking
        uint256 totalSharesYes;
        uint256 totalSharesNo;
        
        
        // [AUDIT-FIX] Refactor: Pre-Deduction Fee Logic
        uint256 netDistributable; // Pool after ALL fees (21%) are deducted
        uint256 referrerPool;     // 5% of Total Pool reserved for Referrers
        
        // [AUDIT-FIX] Beta-05: Round tracking for market reopening
        uint256 roundId;
    }
    
    struct UserBet {
        uint256 amount;
        uint256 shares;
        address referrer;
    }
    
    enum MarketState {
        OPEN,
        LOCKED,     // RESERVED: Not currently used. Do NOT remove (breaks ABI enum values).
        PROPOSED,
        DISPUTED,
        RESOLVED
    }

    enum MarketOutcome {
        PENDING,    // 0
        YES,        // 1
        NO,         // 2
        DRAW,       // 3 (Technical Draw - Takes Fees)
        CANCELLED   // 4 (Admin Cancel - 100% Refund)
    }
    
    // ============ MAPPINGS ============
    
    mapping(string => Market) public markets;
    mapping(string => bool) public marketExists;
    mapping(string => mapping(address => UserBet)) public yesBets;
    mapping(string => mapping(address => UserBet)) public noBets;
    // [AUDIT-FIX] Beta-05: 3D mapping (marketId -> roundId -> user -> claimed)
    // Prevents fund lockup if a market is ever reopened after claims
    mapping(string => mapping(uint256 => mapping(address => bool))) public hasClaimed;
    // [AUDIT-FIX] Removed reporterRewardClaimed (deprecated by Pre-Deduction logic)
    
    // [GAS-OPT] Removed EnumerableSet mappings - using counters in Market struct instead
    
    // ============ EVENTS ============
    
    event MarketCreated(string indexed id, address indexed creator, uint256 deadlineTime, uint256 seedAmount);
    event BetPlaced(string indexed id, address indexed user, bool side, uint256 amount, uint256 shares, address referrer, uint256 weight);
    event MarketStateChanged(string indexed marketId, MarketState oldState, MarketState newState);
    event OutcomeProposed(string indexed id, address indexed proposer, bool result, uint256 bond, uint256 disputeEndTime, string evidence);
    event OutcomeChallenged(string indexed id, address indexed challenger, uint256 bond, string evidence);
    event DisputeResolved(string indexed id, address indexed winner, uint256 totalBondReward, bool finalResult);
    event OutcomeFinalized(string indexed id, address indexed proposer, uint256 reward);
    event MarketResolved(string indexed id, bool result, uint256 winnerPool);
    event MarketVoided(string indexed id);
    event MarketReopened(string indexed id, uint256 newDeadline);
    event PayoutClaimed(string indexed id, address indexed user, uint256 amount);
    event SeedWithdrawn(string indexed id, address indexed creator, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TreasuryChangeProposed(address indexed newTreasury, uint256 executeTime);
    event HouseFeeWithdrawn(address indexed treasury, uint256 amount);
    event BondWithdrawn(address indexed user, uint256 amount);
    event ReporterRewardClaimed(string indexed marketId, address indexed proposer, uint256 reward);
    event CreatorFeesWithdrawn(address indexed creator, uint256 amount);
    event ReferrerFeesWithdrawn(address indexed referrer, uint256 amount);
    // [AUDIT-FIX] Beta-07 MED-2: Dedicated event for seed confiscation (distinct from voluntary withdrawal)
    event SeedConfiscated(string indexed marketId, address indexed creator, address indexed treasury, uint256 amount);
    // [AUDIT-FIX] Beta-08 H-03: Warning when admin resolves to a side with 0 bettors
    event AdminResolveNoWinners(string indexed marketId, MarketOutcome originalOutcome, MarketOutcome forcedOutcome);
    
    address public currentOperator; 

    // ============ CONSTRUCTOR ============
    
    constructor(
        address _admin,
        address _operator,
        address _treasury,
        address _usdcToken
    ) {
        require(_admin != address(0), "Invalid Admin");
        require(_operator != address(0), "Invalid Operator");
        require(_treasury != address(0), "Invalid Treasury");
        
        require(_usdcToken != address(0), "Invalid USDC");
        
        treasury = _treasury;
        usdcToken = IERC20(_usdcToken);
        
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

    // [AUDIT-FIX] Beta-07 ALTO-3: Prevent direct grantRole/revokeRole for OPERATOR_ROLE
    // Forces all operator changes through setOperator() to maintain currentOperator consistency
    function grantRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
        require(role != OPERATOR_ROLE, "Use setOperator()");
        super.grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
        require(role != OPERATOR_ROLE, "Use setOperator()");
        super.revokeRole(role, account);
    }
    
    // ============ MARKET CREATION ============
    
    /**
     * @notice Creates a new prediction market.
     * @dev [ECR-002] Seed is stored separately and NOT added to betting pools.
     *      Seed is fully refundable to the Creator after resolution.
     */
    function createMarket(
        string calldata _question,
        uint256 _usdcSeedAmount,
        uint256 _durationSeconds,
        uint256 _bonusDurationSeconds
    ) external whenNotPaused nonReentrant returns (string memory) {
        // [AUDIT-FIX] Griefing: ID is now deterministic to prevent front-running
        // [AUDIT-FIX] Beta-01 M-02: Added marketCount nonce to prevent collision
        bytes32 rawId = keccak256(abi.encodePacked(msg.sender, _question, block.timestamp, marketCount++));
        string memory _id = _bytes32ToString(rawId);

        require(bytes(_question).length >= 10 && bytes(_question).length <= 500, "Invalid question length");
        require(!marketExists[_id], "Market exists");
        require(_usdcSeedAmount >= 1e6, "Min seed: 1 USDC");
        require(_usdcSeedAmount <= maxMarketPool, "Seed too large");
        // _durationSeconds = 0 creates an open-ended market (no deadline)
        // Open-ended markets can be proposed at any time (e.g. "who posts X first")
        // Time-bound markets can only be proposed after the deadline passes
        
        require(block.timestamp >= lastMarketCreation[msg.sender] + MIN_MARKET_INTERVAL, "Rate limit");
        lastMarketCreation[msg.sender] = block.timestamp;
        
        usdcToken.safeTransferFrom(msg.sender, address(this), _usdcSeedAmount);
        
        // [ECR-002] C-01 FIX: Track Seed in Liabilities
        totalLockedAmount += _usdcSeedAmount;
        
        Market storage m = markets[_id];
        m.id = _id;
        m.creator = msg.sender;
        m.question = _question;
        m.creationTime = block.timestamp; 
        m.bonusDuration = _bonusDurationSeconds > 0 ? _bonusDurationSeconds : _durationSeconds;
        m.deadlineTime = _durationSeconds > 0 ? block.timestamp + _durationSeconds : 0;
        m.state = MarketState.OPEN;
        
        // [ECR-002] Seed is Recoverable, NOT Pool Liquidity
        m.seedAmount = _usdcSeedAmount;
        
        marketExists[_id] = true;
        
        emit MarketCreated(_id, msg.sender, m.deadlineTime, _usdcSeedAmount);
        return _id;
    }
    
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
        // Open-ended markets (deadlineTime=0) accept bets until someone proposes
        require(m.deadlineTime == 0 || block.timestamp < m.deadlineTime, "Expired");
        
        require(_usdcAmount >= MIN_BET_AMOUNT, "Bet too small");
        require(_usdcAmount <= maxBetAmount, "Bet too large");
        
        lastBetTime[_marketId] = block.timestamp;
        lastUserBetTime[_marketId][msg.sender] = block.timestamp;

        uint256 newTotal = m.totalYes + m.totalNo + _usdcAmount;
        require(newTotal <= maxMarketPool, "Pool limit exceeded");
        
        require(_referrer != msg.sender, "Cannot self-refer");
        // [ECR-002] M-01 FIX: Removed _isContract check to allow Smart Wallets/DAOs
        
        usdcToken.safeTransferFrom(msg.sender, address(this), _usdcAmount);
        
        uint256 netAmount = _usdcAmount;
        totalLockedAmount += netAmount;
        
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
        
        // [AUDIT-FIX] Beta-01 M-01: Only count UNIQUE bettors to prevent DoS via counter inflation
        if (userBet.amount == 0) {
            // [AUDIT-FIX] Beta-01 M-03: Referrer Hijacking Fix
            // Only set referrer on first bet. Prevents overwriting with self/other referrer later.
            userBet.referrer = _referrer;
        }
        
        userBet.amount += netAmount;
        userBet.shares += shares;
        // userBet.referrer = _referrer; // MOVED INSIDE CHECK
        
        // [AUDIT-FIX] V9.3: Emit actual weight used (MAX or MIN), not the 50 placeholder
        uint256 weight = isEarlyBird ? MAX_WEIGHT : MIN_WEIGHT;
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
        require(bytes(_evidenceUrl).length <= 512, "Evidence URL too long");
        
        Market storage m = markets[_marketId];
        require(m.state == MarketState.OPEN, "Invalid state");
        
        // [AUDIT-FIX] Beta-02 H-01: Strict deadline enforcement
        // Time-bound markets: ONLY proposable after deadline passes (no cooldown bypass)
        // Open-ended markets: proposable anytime with MEV cooldown
        if (m.deadlineTime > 0) {
            // Time-bound market: deadline is the ONLY gatekeeper
            require(block.timestamp >= m.deadlineTime, "Deadline not reached");
        } else {
            // [AUDIT-FIX] Beta-04: Per-user MEV protection for open-ended markets
            // Only checks the PROPOSER's last bet, not global. Prevents griefing.
            // Sybil (2-wallet) attack is mitigated by DISPUTE_WINDOW (12h) + bond requirement
            require(block.timestamp >= lastUserBetTime[_marketId][msg.sender] + 5 minutes, "MEV protection: wait 5min after your last bet");
            
            // Open-ended market: creator must wait 24h to prevent self-gaming
            if (msg.sender == m.creator) {
                require(block.timestamp >= m.creationTime + 24 hours, "Creator: wait 24h");
            }
        }

        uint256 requiredBond = _getRequiredBond(m.totalYes + m.totalNo);
        require(_bondAmount >= requiredBond, "Insufficient bond");
        
        usdcToken.safeTransferFrom(msg.sender, address(this), _bondAmount);
        
        totalLockedAmount += _bondAmount;
        
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
        require(bytes(_evidenceUrl).length <= 512, "Evidence URL too long");
        
        Market storage m = markets[_marketId];
        require(m.state == MarketState.PROPOSED, "Not proposed");
        require(block.timestamp <= m.proposalTime + DISPUTE_WINDOW, "Window closed");
        require(_bondAmount >= m.bondAmount, "Insufficient bond");
        require(msg.sender != m.proposer, "Cannot self-challenge");
        
        usdcToken.safeTransferFrom(msg.sender, address(this), _bondAmount);
        
        totalLockedAmount += _bondAmount;
        
        _updateMarketState(m, MarketState.DISPUTED);
        
        m.challenger = msg.sender;
        m.challengeBondAmount = _bondAmount;
        m.challengeEvidenceUrl = _evidenceUrl;
        m.challengeTime = block.timestamp;
        
        emit OutcomeChallenged(_marketId, msg.sender, _bondAmount, _evidenceUrl);
    }
    
    // ============ RESOLUTION ============
    
    function resolveDispute(
        string calldata _marketId,
        address _winnerAddress
    ) external nonReentrant {
        require(hasRole(OPERATOR_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.DISPUTED, "Not disputed");
        require(_winnerAddress == m.proposer || _winnerAddress == m.challenger, "Invalid winner");
        
        uint256 totalBond = m.bondAmount + m.challengeBondAmount;
        
        // [AUDIT-FIX] Beta-01 C-01: Proper incentive alignment
        // Winner gets own bond back + 80% of loser's bond
        // Treasury receives 20% slash from loser's bond (anti-self-challenge deterrent)
        uint256 winnerBond = (_winnerAddress == m.proposer) ? m.bondAmount : m.challengeBondAmount;
        uint256 loserBond = totalBond - winnerBond;
        uint256 loserSlash = loserBond * 20 / 100;
        uint256 winnerReward = winnerBond + loserBond - loserSlash;
        claimableBonds[_winnerAddress] += winnerReward;
        
        // [AUDIT-FIX] CRITICAL: Determine outcome BEFORE reassigning m.proposer
        // Otherwise _winnerAddress == m.proposer is always true (dead else branch)
        if (_winnerAddress == m.proposer) {
            // Proposer was correct
            m.outcome = m.proposedResult ? MarketOutcome.YES : MarketOutcome.NO;
        } else {
            // Challenger was correct -> flip the proposed result
            m.outcome = !m.proposedResult ? MarketOutcome.YES : MarketOutcome.NO;
        }
        
        // Now transfer proposer role to winner (for reporter reward)
        m.proposer = _winnerAddress;
        
        _updateMarketState(m, MarketState.RESOLVED);
        
        m.bondAmount = 0;
        m.challengeBondAmount = 0;
        
        // [AUDIT-FIX] Process fees at resolution
        _processMarketFees(_marketId);
        
        // [AUDIT-FIX] Beta-08 M-03: CEI compliance — external transfer AFTER all state updates
        if (loserSlash > 0) {
            totalLockedAmount -= loserSlash;
            usdcToken.safeTransfer(treasury, loserSlash);
        }
        
        bool finalResultBool = m.outcome == MarketOutcome.YES;
        emit DisputeResolved(_marketId, _winnerAddress, totalBond, finalResultBool);
        emit MarketResolved(_marketId, finalResultBool, finalResultBool ? m.totalYes : m.totalNo);
    }

    /**
     * @notice Allows Admin to force resolve a dispute to a specific result (YES/NO/DRAW).
     * @dev Used for arbitration if the automated dispute process is stuck or requires human intervention.
     */
    function adminResolve(string calldata _marketId, MarketOutcome _outcome, bool _slashCreator) external nonReentrant {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not admin");
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        // [V10] Admin can resolve from ANY active state (OPEN, LOCKED, PROPOSED, DISPUTED)
        require(m.state != MarketState.RESOLVED, "Already resolved");
        // [AUDIT-FIX] Beta-07 ALTO-1: Reject PENDING as valid outcome
        require(
            _outcome == MarketOutcome.YES ||
            _outcome == MarketOutcome.NO ||
            _outcome == MarketOutcome.DRAW ||
            _outcome == MarketOutcome.CANCELLED,
            "Invalid outcome"
        );
        
        // [AUDIT-FIX] V9.4 H-02: Slashing Logic
        // If _slashCreator is true (e.g. fraudulent market), the seed is confiscated to Treasury.
        // [AUDIT-FIX] Beta-08 M-03: Defer safeTransfer to end of function (CEI compliance)
        uint256 _pendingSeedSlash = 0;
        uint256 _pendingBondSlash = 0;
        if (_slashCreator && m.seedAmount > 0) {
            _pendingSeedSlash = m.seedAmount;
            m.seedAmount = 0; // Remove claim rights
            totalLockedAmount -= _pendingSeedSlash; // Remove from liabilities
            // [AUDIT-FIX] Beta-07 MED-2: Use dedicated confiscation event (not SeedWithdrawn)
            emit SeedConfiscated(_marketId, m.creator, treasury, _pendingSeedSlash);
        }

        // [AUDIT-FIX] Incentive Alignment via "Skin in the Game"
        // If Admin confirms the Proposal -> Proposer wins Bond + Challenge Bond
        // If Admin rejects the Proposal -> Challenger wins Bond + Challenge Bond
        // If DRAW/CANCEL -> Refund both (Neutral)

        uint256 totalBond = m.bondAmount + m.challengeBondAmount;
        address winnerAddress = address(0);

        bool isProposalCorrect = false;
        // [AUDIT-FIX] Beta-06 H-02: Only evaluate proposal correctness if a proposal actually exists
        bool hasProposal = (m.proposer != address(0));
        
        if (hasProposal) {
            if (_outcome == MarketOutcome.YES && m.proposedResult == true) isProposalCorrect = true;
            if (_outcome == MarketOutcome.NO && m.proposedResult == false) isProposalCorrect = true;
        }
        
        // Determine Winner
        if (_outcome == MarketOutcome.CANCELLED || _outcome == MarketOutcome.DRAW) {
            // Neutral Outcome: Refund everyone
            if (m.bondAmount > 0) claimableBonds[m.proposer] += m.bondAmount;
            if (m.challengeBondAmount > 0) claimableBonds[m.challenger] += m.challengeBondAmount;
        } else {
            // Binary Outcome
            if (isProposalCorrect) {
                 winnerAddress = m.proposer;
            } else {
                 // Proposal was WRONG. If challenged, Challenger wins. 
                 if (m.challenger != address(0)) {
                     winnerAddress = m.challenger;
                 } else {
                     // [AUDIT-FIX] Beta-06 H-02: Removed dead else branch (winnerAddress = m.challenger)
                     // That branch was unreachable: we only get here when m.challenger == address(0),
                     // so assigning m.challenger would always yield address(0).
                     if (m.state == MarketState.PROPOSED && m.bondAmount > 0) {
                         // Confiscate liar's bond to Treasury
                         // [AUDIT-FIX] Beta-08 M-03: Capture amount for deferred transfer (CEI)
                         _pendingBondSlash += m.bondAmount;
                         totalLockedAmount -= m.bondAmount;
                         // Clear malicious proposer so reporter reward goes to treasury
                         m.proposer = address(0);
                     }
                     // winnerAddress remains address(0) — no valid winner in this path
                 }
            }
            
            // [AUDIT-FIX] Beta-01 H-01: Transfer proposer role to the dispute winner
            // so claimReporterReward (1%) goes to the honest party, not the liar
            if (winnerAddress != address(0)) {
                m.proposer = winnerAddress;
                if (totalBond > 0) {
                    // [AUDIT-FIX] Beta-01 C-01 + H-01: Proper bond incentive alignment
                    if (m.challengeBondAmount == 0) {
                        // No dispute: Return 100% bond to honest proposer
                        claimableBonds[winnerAddress] += totalBond;
                    } else {
                        // With dispute: Winner gets own bond + 80% of loser's bond
                        // Treasury receives 20% slash (anti-self-challenge deterrent)
                        uint256 winnerBond = isProposalCorrect ? m.bondAmount : m.challengeBondAmount;
                        uint256 loserBond = totalBond - winnerBond;
                        uint256 loserSlash = loserBond * 20 / 100;
                        claimableBonds[winnerAddress] += winnerBond + loserBond - loserSlash;
                        if (loserSlash > 0) {
                            totalLockedAmount -= loserSlash;
                            // [AUDIT-FIX] Beta-08 M-03: Capture for deferred transfer (CEI)
                            _pendingBondSlash += loserSlash;
                        }
                    }
                }
            }
        }
        
        // [AUDIT-FIX] Reporter Reward Trap Fix
        if (m.proposer == address(0)) {
            m.proposer = treasury;
        }

        m.bondAmount = 0;
        m.challengeBondAmount = 0;

        _updateMarketState(m, MarketState.RESOLVED);
        m.outcome = _outcome;

        // [AUDIT-FIX] Beta-08 H-03: Auto-DRAW when winning side has 0 bettors
        // Prevents funds from being stuck (claimWinnings would revert on "No winning shares")
        if (_outcome == MarketOutcome.YES && m.totalSharesYes == 0 && m.totalNo > 0) {
            m.outcome = MarketOutcome.DRAW;
            emit AdminResolveNoWinners(_marketId, _outcome, MarketOutcome.DRAW);
        } else if (_outcome == MarketOutcome.NO && m.totalSharesNo == 0 && m.totalYes > 0) {
            m.outcome = MarketOutcome.DRAW;
            emit AdminResolveNoWinners(_marketId, _outcome, MarketOutcome.DRAW);
        }
        
        // [AUDIT-FIX] Fee Refactor: Process fees immediately upon resolution
        _processMarketFees(_marketId);

        // [AUDIT-FIX] Beta-08 M-03: CEI compliance — single batched transfer to treasury
        uint256 _totalPendingTransfer = _pendingSeedSlash + _pendingBondSlash;
        
        bool finalResultBool = m.outcome == MarketOutcome.YES;
        emit MarketResolved(_marketId, finalResultBool, finalResultBool ? m.totalYes : m.totalNo);

        // Final external interaction: single batched transfer to treasury
        if (_totalPendingTransfer > 0) {
            usdcToken.safeTransfer(treasury, _totalPendingTransfer);
        }
    }
    
    function emergencyResolve(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.DISPUTED, "Not disputed");
        
        require(block.timestamp > m.challengeTime + EMERGENCY_TIMEOUT, "Time lock active");
        
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
        
        // [AUDIT-FIX] Beta-08 C-02: Consistent _processMarketFees call
        // For CANCELLED, this just sets netDistributable = totalPool (no fees taken)
        _processMarketFees(_marketId);
        
        emit MarketVoided(_marketId);
    }

    function finalizeOutcome(string calldata _marketId) external whenNotPaused nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        
        require(m.state == MarketState.PROPOSED, "Not proposed");
        require(block.timestamp > m.proposalTime + DISPUTE_WINDOW, "Window active");
        
        address proposer = m.proposer;
        uint256 bondAmount = m.bondAmount;
        
        claimableBonds[proposer] += bondAmount;
        
        m.bondAmount = 0;
        
        _updateMarketState(m, MarketState.RESOLVED);
        m.outcome = m.proposedResult ? MarketOutcome.YES : MarketOutcome.NO;
        
        // [AUDIT-FIX] Fee Refactor: Process fees immediately upon resolution
        _processMarketFees(_marketId);
        
        bool finalResultBool = m.outcome == MarketOutcome.YES;
        // [AUDIT-FIX] Beta-07 INFO-2: Emit actual reporter reward instead of hardcoded 0
        uint256 totalPool = m.totalYes + m.totalNo;
        uint256 repFee = (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
        emit OutcomeFinalized(_marketId, proposer, repFee);
        emit MarketResolved(_marketId, finalResultBool, finalResultBool ? m.totalYes : m.totalNo);
    }

    // ============ CLAIMS & WITHDRAWALS ============

    function claimWinnings(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(!hasClaimed[_marketId][m.roundId][msg.sender], "Already claimed");
        
        uint256 payout = 0;
        UserBet storage yesBet = yesBets[_marketId][msg.sender];
        UserBet storage noBet = noBets[_marketId][msg.sender];

        if (m.outcome == MarketOutcome.CANCELLED) {
            // CANCELLED: Full Refund (no fees)
            payout = yesBet.amount + noBet.amount;
        } 
        else if (m.outcome == MarketOutcome.DRAW) {
            // [AUDIT-FIX] Beta-02 MH-01: DRAW refund uses USDC amounts (not shares)
            // This prevents Early Bird bonus from diluting late bettors' principal
            uint256 userTotalAmount = yesBet.amount + noBet.amount;
            uint256 totalPoolAmount = m.totalYes + m.totalNo;
            
            if (userTotalAmount > 0 && totalPoolAmount > 0) {
                uint256 refReward;
                
                // Last user sweep: clear ALL remaining dust
                if (userTotalAmount == totalPoolAmount) {
                    payout = m.netDistributable;
                    refReward = m.referrerPool;
                } else {
                    payout = (userTotalAmount * m.netDistributable) / totalPoolAmount;
                    refReward = (userTotalAmount * m.referrerPool) / totalPoolAmount;
                }
                
                address ref = yesBet.referrer != address(0) ? yesBet.referrer : noBet.referrer;
                if (ref != address(0)) {
                    rewardsBalance[ref] += refReward;
                } else {
                    houseBalance += refReward;
                }
                
                // Decremental tracking: deduct claimed USDC amounts to eliminate dust
                m.netDistributable -= payout;
                m.referrerPool -= refReward;
                m.totalYes -= yesBet.amount;
                m.totalNo -= noBet.amount;
            }
        }
        else {
            // YES or NO outcome: Parimutuel payout from netDistributable
            bool isYesWinner = m.outcome == MarketOutcome.YES;
            UserBet storage winningBet = isYesWinner ? yesBet : noBet;
            
            if (winningBet.amount > 0 && winningBet.shares > 0) {
                uint256 totalWinningShares = isYesWinner ? m.totalSharesYes : m.totalSharesNo;
                require(totalWinningShares > 0, "No winning shares");
                
                uint256 refReward;

                // [AUDIT-FIX] Refinement: Explicit check for last user to clear ALL dust
                if (winningBet.shares == totalWinningShares) {
                    payout = m.netDistributable;
                    refReward = m.referrerPool;
                } else {
                    payout = (winningBet.shares * m.netDistributable) / totalWinningShares;
                    refReward = (winningBet.shares * m.referrerPool) / totalWinningShares;
                }
                
                if (winningBet.referrer != address(0)) {
                    rewardsBalance[winningBet.referrer] += refReward;
                } else {
                    houseBalance += refReward;
                }
                
                // [AUDIT-FIX] Decremental pool: deduct claimed amounts to eliminate dust
                m.netDistributable -= payout;
                m.referrerPool -= refReward;
                if (isYesWinner) {
                    m.totalSharesYes -= winningBet.shares;
                } else {
                    m.totalSharesNo -= winningBet.shares;
                }
            }
        }
        
        require(payout > 0, "Nothing to claim");
        
        hasClaimed[_marketId][m.roundId][msg.sender] = true;
        totalLockedAmount -= payout;
        
        usdcToken.safeTransfer(msg.sender, payout);
        emit PayoutClaimed(_marketId, msg.sender, payout);
    }
    
    function _processMarketFees(string calldata _marketId) internal {
        Market storage m = markets[_marketId];
        uint256 totalPool = m.totalYes + m.totalNo;
        
        if (m.outcome == MarketOutcome.CANCELLED) {
            m.netDistributable = totalPool;
            return;
        }
        
        // Fees: House 10% + Creator 5% + Referrer 5% + Reporter 1% = 21%
        uint256 houseFee = (totalPool * houseFeeBps) / FEE_DENOMINATOR;
        uint256 creatorFee = (totalPool * creatorFeeBps) / FEE_DENOMINATOR;
        uint256 repFee = (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
        uint256 refPool = (totalPool * referrerFeeBps) / FEE_DENOMINATOR;
        
        // Credit balances immediately
        houseBalance += houseFee;
        creatorBalance[m.creator] += creatorFee;
        
        // Reporter reward -> rewardsBalance (claimable via withdrawReferrerFees)
        if (m.proposer != address(0)) {
            rewardsBalance[m.proposer] += repFee;
        } else {
            houseBalance += repFee;
        }
        
        // Referrer pool held until user claims (distributed per-user in claimWinnings)
        m.referrerPool = refPool;
        
        // Net pool for winners/drawers
        m.netDistributable = totalPool - houseFee - creatorFee - repFee - refPool;
        
        // [AUDIT-FIX] Beta-08 C-01 RATIONALE (FALSE POSITIVE — verified correct):
        // No totalLockedAmount changes here. Fees are moved between internal liability
        // buckets (houseBalance, creatorBalance, rewardsBalance, referrerPool).
        // The USDC remains in the contract. Decrements happen ONLY in withdraw*
        // functions when USDC actually leaves. The sum of all decrements always equals
        // the sum of all increments regardless of withdrawal order. Proven correct for
        // single and multi-market scenarios.
    }

    // Reporter rewards are now credited automatically via _processMarketFees -> rewardsBalance
    // Reporters withdraw using withdrawReferrerFees()

    function voidMarket(string calldata _marketId) external nonReentrant {
        require(hasRole(OPERATOR_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        // [AUDIT-FIX] Beta-06 H-01: Prevent ghost market creation via non-existent IDs
        require(marketExists[_marketId], "No market");

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
        
        // [AUDIT-FIX] Beta-08 C-02/M-01: Consistent _processMarketFees call
        // For CANCELLED, this just sets netDistributable = totalPool (no fees taken)
        _processMarketFees(_marketId);
        
        emit MarketVoided(_marketId);
    }

    /**
     * @notice [V10] Reopen a market that was proposed/disputed.
     * @dev Reverts market state to OPEN, refunds all bonds, and optionally extends deadline.
     *      Primary use case: Open-ended markets where a false proposal was made.
     *      Also usable for time-bound markets if admin wants to reopen after an unfair resolution.
     * @param _marketId The market to reopen
     * @param _extensionSeconds Additional seconds to add to the deadline (0 = keep original)
     */
    function reopenMarket(
        string calldata _marketId,
        uint256 _extensionSeconds,
        bool _slashProposer
    ) external nonReentrant {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not admin");
        require(marketExists[_marketId], "No market");
        
        Market storage m = markets[_marketId];
        require(
            m.state == MarketState.PROPOSED || m.state == MarketState.DISPUTED,
            "Can only reopen proposed/disputed markets"
        );
        
        // [AUDIT-FIX] Beta-03 H-02: Slash proposer bond with challenger incentive
        if (_slashProposer && m.bondAmount > 0) {
            if (m.challengeBondAmount > 0) {
                // Challenger existed and was correct — reward them 80%, treasury gets 20%
                uint256 reward = (m.bondAmount * 80) / 100;
                uint256 slash = m.bondAmount - reward;
                claimableBonds[m.challenger] += reward;
                totalLockedAmount -= slash;
                usdcToken.safeTransfer(treasury, slash);
            } else {
                // No challenger — treasury gets 100% of malicious proposer's bond
                totalLockedAmount -= m.bondAmount;
                usdcToken.safeTransfer(treasury, m.bondAmount);
            }
            m.bondAmount = 0;
        } else if (m.bondAmount > 0) {
            // Refund proposer bond (good faith proposal)
            claimableBonds[m.proposer] += m.bondAmount;
            m.bondAmount = 0;
        }
        
        // Refund challenger bond (challenger acted in good faith by challenging)
        if (m.challengeBondAmount > 0) {
            claimableBonds[m.challenger] += m.challengeBondAmount;
            m.challengeBondAmount = 0;
        }
        
        // Reset proposal/dispute data
        m.proposer = address(0);
        m.proposedResult = false;
        m.proposalTime = 0;
        m.evidenceUrl = "";
        m.challenger = address(0);
        m.challengeEvidenceUrl = "";
        m.challengeTime = 0;
        
        // Extend deadline if requested
        if (_extensionSeconds > 0) {
            m.deadlineTime = block.timestamp + _extensionSeconds;
        } else if (m.deadlineTime > 0 && block.timestamp >= m.deadlineTime) {
            // [AUDIT-FIX] Beta-05: Prevent zombie markets
            // If time-bound market already expired, MUST provide an extension
            revert("Must extend deadline for expired market");
        }
        
        // [AUDIT-FIX] Beta-05: Increment round so hasClaimed resets for all users
        m.roundId++;
        
        // Reset lastBetTime for open-ended market tracking
        lastBetTime[_marketId] = block.timestamp;
        
        // Revert state to OPEN
        _updateMarketState(m, MarketState.OPEN);
        
        emit MarketReopened(_marketId, m.deadlineTime);
    }

    function voidAbandonedMarket(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.OPEN || m.state == MarketState.LOCKED, "Invalid state");
        require(m.deadlineTime > 0, "Open-ended: use voidMarket");
        require(block.timestamp > m.deadlineTime + 30 days, "Not abandoned");
        
        _updateMarketState(m, MarketState.RESOLVED);
        m.outcome = MarketOutcome.CANCELLED;
        
        // [AUDIT-FIX] Beta-08 M-01: Consistent _processMarketFees call
        // For CANCELLED, this just sets netDistributable = totalPool (no fees taken)
        _processMarketFees(_marketId);
        
        emit MarketVoided(_marketId);
    }

    /**
     * @notice [ECR-002] Recoverable Seed: Creator withdraws seed after ANY resolution.
     * @dev Seed is returned 100% to creator. It was never part of the betting pool.
     */
    function withdrawSeed(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(msg.sender == m.creator, "Only creator");
        require(!m.seedWithdrawn, "Already withdrawn");
        require(m.seedAmount > 0, "No seed");
        
        uint256 amount = m.seedAmount;
        m.seedWithdrawn = true;
        
        // [ECR-002] C-01 FIX: Decrement liability
        totalLockedAmount -= amount;
        
        usdcToken.safeTransfer(msg.sender, amount);
        emit SeedWithdrawn(_marketId, msg.sender, amount);
    }
    
    function withdrawBond() external nonReentrant {
        uint256 amount = claimableBonds[msg.sender];
        require(amount > 0, "No bonds");
        claimableBonds[msg.sender] = 0;
        
        totalLockedAmount -= amount;
        
        usdcToken.safeTransfer(msg.sender, amount);
        emit BondWithdrawn(msg.sender, amount);
    }
    
    function withdrawCreatorFees() external nonReentrant {
        uint256 amount = creatorBalance[msg.sender];
        require(amount > 0, "No fees");
        creatorBalance[msg.sender] = 0;
        
        totalLockedAmount -= amount;
        
        usdcToken.safeTransfer(msg.sender, amount);
        emit CreatorFeesWithdrawn(msg.sender, amount);
    }
    
    function withdrawReferrerFees() external nonReentrant {
        uint256 amount = rewardsBalance[msg.sender];
        require(amount > 0, "No fees");
        rewardsBalance[msg.sender] = 0;
        
        totalLockedAmount -= amount;
        
        usdcToken.safeTransfer(msg.sender, amount);
        emit ReferrerFeesWithdrawn(msg.sender, amount);
    }
    
    function withdrawHouseFees() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 amount = houseBalance;
        require(amount > 0, "No fees");
        houseBalance = 0;
        
        totalLockedAmount -= amount;
        
        usdcToken.safeTransfer(treasury, amount);
        emit HouseFeeWithdrawn(treasury, amount);
    }

    /**
     * @notice Convert a no-winner market to DRAW for proportional refund.
     * @dev WARNING: This applies protocol fees (21%). Users receive ~79% of their bet.
     *      For a 100% refund with NO fees, use voidMarket() BEFORE resolution instead.
     *      Only use claimFallback when the market is already RESOLVED and cannot be voided.
     */
    function claimFallback(string calldata _marketId) external nonReentrant {
        // [AUDIT-FIX] Admin-only to prevent creator rug pull
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not admin");
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(m.outcome == MarketOutcome.YES || m.outcome == MarketOutcome.NO, "Invalid outcome");
        
        uint256 totalWinningShares = (m.outcome == MarketOutcome.YES) ? m.totalSharesYes : m.totalSharesNo;
        require(totalWinningShares == 0, "Winners exist");
        
        // [AUDIT-FIX] No winners = convert to DRAW for proportional refund
        // Users claim their share via claimWinnings (DRAW path)
        m.outcome = MarketOutcome.DRAW;
        
        // Move unused referrer pool to house
        uint256 unusedReferrerPool = m.referrerPool;
        if (unusedReferrerPool > 0) {
            houseBalance += unusedReferrerPool;
            m.referrerPool = 0;
        }
        
        emit MarketVoided(_marketId);
    }

    // ============ INTERNAL ============
    
    function _calculateShares(uint256 /*yesPool*/, uint256 /*noPool*/, uint256 betAmount, bool isEarlyBird) internal pure returns (uint256) {
        // [AUDIT-FIX] Critical: Removed static odds calculation. 
        // Shares are now strictly proportional to the amount wagered (Parimutuel Standard).
        
        uint256 weight = isEarlyBird ? MAX_WEIGHT : MIN_WEIGHT;
        
        // Shares = Amount * Weight
        // Example: 100 USDC * 1.2 (Early Bird) = 120 Shares
        return (betAmount * weight * SHARE_PRECISION) / 100;
    }

    function _calculateWeight(uint256 /*yesPool*/, uint256 /*noPool*/) internal pure returns (uint256) {
        // [AUDIT-FIX] Weight is now static based on Early Bird, no dynamic pool weight needed for display
        return 50; // Placeholder for UI compatibility
    }
    
    function _getRequiredBond(uint256 poolSize) internal pure returns (uint256) {
        return MIN_BOND + (poolSize / 100);
    }
    
    function _updateMarketState(Market storage m, MarketState newState) internal {
        emit MarketStateChanged(m.id, m.state, newState);
        m.state = newState;
    }

    // ============ VIEW ============

    function getMarketDetails(string calldata _marketId) external view returns (
        MarketState state, MarketOutcome outcome, uint256 totalYes, uint256 totalNo, uint256 deadlineTime, address creator, uint256 seedAmount
    ) {
        Market storage m = markets[_marketId];
        return (m.state, m.outcome, m.totalYes, m.totalNo, m.deadlineTime, m.creator, m.seedAmount);
    }

    function sweepDust() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 contractBalance = usdcToken.balanceOf(address(this));
        require(contractBalance > totalLockedAmount, "No dust");
        
        uint256 dust = contractBalance - totalLockedAmount;
        usdcToken.safeTransfer(treasury, dust);
    }

    function _bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
        return string(abi.encodePacked("0x", _toHexString(uint256(_bytes32), 32)));
    }

    function _toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length);
        for (uint256 i = 2 * length; i > 0; --i) {
            buffer[i - 1] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }
    
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";
}
