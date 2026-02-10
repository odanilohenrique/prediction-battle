// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionBattleV9
 * @notice Version 9: Audit Remediation (ECR-002) - Recoverable Seed & Solvency Fixes
 * @dev Fixes: C-01 (Seed Tracking), H-01 (Fee Distribution), M-01 (Smart Wallet Referrers)
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
// [GAS-OPT] Removed EnumerableSet - replaced with simple counters

contract PredictionBattleV9 is ReentrancyGuard, Pausable, AccessControl {
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
    uint256 public constant MAX_BETTORS_PER_SIDE = 10000;
    
    // Rate limiting
    mapping(address => uint256) public lastMarketCreation;
    mapping(string => uint256) public lastBetTime;
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
        
        // [GAS-OPT] Bettor Counters (replaced EnumerableSet)
        uint256 yesBettorsCount;
        uint256 noBettorsCount;
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
    mapping(string => mapping(address => bool)) public hasClaimed;
    mapping(string => bool) public reporterRewardClaimed;
    
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
        bytes32 rawId = keccak256(abi.encodePacked(msg.sender, _question, block.timestamp));
        string memory _id = _bytes32ToString(rawId);

        require(bytes(_question).length >= 10 && bytes(_question).length <= 500, "Invalid question length");
        require(!marketExists[_id], "Market exists");
        require(_usdcSeedAmount >= 1e6, "Min seed: 1 USDC");
        require(_usdcSeedAmount <= maxMarketPool, "Seed too large");
        require(_durationSeconds > 0, "Invalid duration");
        
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
        m.deadlineTime = block.timestamp + _durationSeconds; 
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
        require(block.timestamp < m.deadlineTime, "Expired"); 
        
        require(_usdcAmount >= MIN_BET_AMOUNT, "Bet too small");
        require(_usdcAmount <= maxBetAmount, "Bet too large");
        
        lastBetTime[_marketId] = block.timestamp;

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
        userBet.amount += netAmount;
        userBet.shares += shares;
        userBet.referrer = _referrer;
        
        // [GAS-OPT] Use simple counters instead of EnumerableSet
        if (_side) {
            require(m.yesBettorsCount < MAX_BETTORS_PER_SIDE, "Max bettors reached");
            m.yesBettorsCount++;
        } else {
            require(m.noBettorsCount < MAX_BETTORS_PER_SIDE, "Max bettors reached");
            m.noBettorsCount++;
        }
        
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
        require(m.state == MarketState.OPEN || m.state == MarketState.LOCKED, "Invalid state");
        
        if (msg.sender == m.creator) {
            require(block.timestamp >= m.creationTime + 24 hours, "Creator: wait 24h");
        }

        require(block.timestamp >= lastBetTime[_marketId] + 30 minutes, "Cool-down: wait 30min after last bet");

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
        claimableBonds[_winnerAddress] += totalBond;
        
        m.proposer = _winnerAddress;
        
        _updateMarketState(m, MarketState.RESOLVED);
        
        if (_winnerAddress == m.proposer) {
            m.outcome = m.proposedResult ? MarketOutcome.YES : MarketOutcome.NO;
        } else {
            m.outcome = !m.proposedResult ? MarketOutcome.YES : MarketOutcome.NO;
        }
        
        m.bondAmount = 0;
        m.challengeBondAmount = 0;
        
        // Note: Fees are distributed at claim time (per-user) for gas efficiency
        
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
        require(m.state == MarketState.DISPUTED || m.state == MarketState.PROPOSED, "Invalid state");
        
        // [AUDIT-FIX] V9.4 H-02: Slashing Logic
        // If _slashCreator is true (e.g. fraudulent market), the seed is confiscated to Treasury.
        if (_slashCreator && m.seedAmount > 0) {
            uint256 seed = m.seedAmount;
            m.seedAmount = 0; // Remove claim rights
            totalLockedAmount -= seed; // Remove from liabilities
            usdcToken.safeTransfer(treasury, seed);
            emit SeedWithdrawn(_marketId, treasury, seed); // Re-using event or we can emit nothing/custom
        }

        // [AUDIT-FIX] Incentive Alignment via "Skin in the Game"
        // If Admin confirms the Proposal -> Proposer wins Bond + Challenge Bond
        // If Admin rejects the Proposal -> Challenger wins Bond + Challenge Bond
        // If DRAW/CANCEL -> Refund both (Neutral)

        uint256 totalBond = m.bondAmount + m.challengeBondAmount;
        address winnerAddress = address(0);

        bool isProposalCorrect = false;
        
        if (_outcome == MarketOutcome.YES && m.proposedResult == true) isProposalCorrect = true;
        if (_outcome == MarketOutcome.NO && m.proposedResult == false) isProposalCorrect = true;
        
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
                     // [AUDIT-FIX] V9.4 H-01: Direct Transfer
                     // If no challenger, bond is confiscated to Treasury DIRECTLY (not claimableBonds)
                     if (m.state == MarketState.PROPOSED) {
                         // Liar Proposer, Admin caught them. 
                         // Burn/Confiscate bond to Treasury directly to avoid "Locked Funds in Smart Wallet" issue.
                         totalLockedAmount -= m.bondAmount; // Remove from liabilities logic if we consider bond part of it? 
                         // Wait, bond is in totalLockedAmount? Yes, line 372.
                         // So we must decrement totalLockedAmount if we transfer out.
                         usdcToken.safeTransfer(treasury, m.bondAmount);
                         
                         // winnerAddress remains 0.
                     } else {
                         winnerAddress = m.challenger;
                     }
                 }
            }
            
            if (winnerAddress != address(0) && totalBond > 0) {
                claimableBonds[winnerAddress] += totalBond;
            }
        }

        m.bondAmount = 0;
        m.challengeBondAmount = 0;

        _updateMarketState(m, MarketState.RESOLVED);
        m.outcome = _outcome;
        
        bool finalResultBool = m.outcome == MarketOutcome.YES;
        emit MarketResolved(_marketId, finalResultBool, finalResultBool ? m.totalYes : m.totalNo);
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
        
        emit MarketVoided(_marketId);
    }

    function finalizeOutcome(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        
        require(m.state == MarketState.PROPOSED, "Not proposed");
        require(block.timestamp > m.proposalTime + DISPUTE_WINDOW, "Window active");
        
        address proposer = m.proposer;
        uint256 bondAmount = m.bondAmount;
        
        claimableBonds[proposer] += bondAmount;
        
        _updateMarketState(m, MarketState.RESOLVED);
        m.outcome = m.proposedResult ? MarketOutcome.YES : MarketOutcome.NO;
        m.bondAmount = 0;
        
        // Note: Fees are distributed at claim time (per-user) for gas efficiency
        
        bool finalResultBool = m.outcome == MarketOutcome.YES;
        emit OutcomeFinalized(_marketId, proposer, 0);
        emit MarketResolved(_marketId, finalResultBool, finalResultBool ? m.totalYes : m.totalNo);
    }

    // ============ CLAIMS & WITHDRAWALS ============

    function claimWinnings(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(!hasClaimed[_marketId][msg.sender], "Already claimed");
        
        uint256 payout = 0;
        UserBet storage yesBet = yesBets[_marketId][msg.sender];
        UserBet storage noBet = noBets[_marketId][msg.sender];

        if (m.outcome == MarketOutcome.CANCELLED) {
            // Refund 100% - No fees
            payout = yesBet.amount + noBet.amount;
        } 
        else if (m.outcome == MarketOutcome.DRAW) {
            // [ECR-002] DRAW: Refund - 20% Fee + 1% Reporter, distributed proportionally
            uint256 totalUserBet = yesBet.amount + noBet.amount;
            if (totalUserBet > 0) {
                // FIXED (C-01): Include REPORTER_REWARD_BPS in the fee deduction
                uint256 totalFeesBps = houseFeeBps + creatorFeeBps + referrerFeeBps + REPORTER_REWARD_BPS;
                uint256 fee = (totalUserBet * totalFeesBps) / FEE_DENOMINATOR;
                
                payout = totalUserBet - fee;
                
                // Distribute fees for THIS user's bet (Reporter reward stays in contract for claimReporterReward)
                _distributeUserFees(totalUserBet, m.creator, yesBet.referrer != address(0) ? yesBet.referrer : noBet.referrer);
            }
        }
        else {
            // YES or NO outcome
            bool isYesWinner = m.outcome == MarketOutcome.YES;
            UserBet storage winningBet = isYesWinner ? yesBet : noBet;
            
            if (winningBet.amount > 0 && winningBet.shares > 0) {
                uint256 totalPool = m.totalYes + m.totalNo;
                uint256 totalWinningShares = isYesWinner ? m.totalSharesYes : m.totalSharesNo;
                require(totalWinningShares > 0, "No winning shares");

                // [ECR-002] H-01 FIX: Calculate user's proportional share of the pool
                // Then deduct their proportional fees and credit balances
                
                // User's share of gross pool (before fees)
                uint256 grossPayout = (winningBet.shares * totalPool) / totalWinningShares;
                
                // Calculate fees on user's gross payout
                uint256 totalFeesBps = houseFeeBps + creatorFeeBps + referrerFeeBps + REPORTER_REWARD_BPS;
                uint256 userFees = (grossPayout * totalFeesBps) / FEE_DENOMINATOR;
                payout = grossPayout - userFees;
                
                // [ECR-002] H-01 FIX: Distribute this user's fee portion to balances
                // Note: Reporter reward is claimed separately, so we only distribute House + Creator + Referrer here
                uint256 houseFee = (grossPayout * houseFeeBps) / FEE_DENOMINATOR;
                uint256 creatorFee = (grossPayout * creatorFeeBps) / FEE_DENOMINATOR;
                uint256 referrerFee = (grossPayout * referrerFeeBps) / FEE_DENOMINATOR;
                
                houseBalance += houseFee;
                creatorBalance[m.creator] += creatorFee;
                if (winningBet.referrer != address(0)) {
                    rewardsBalance[winningBet.referrer] += referrerFee;
                } else {
                    // No referrer - fee goes to house
                    houseBalance += referrerFee;
                }
            }
        }
        
        require(payout > 0, "Nothing to claim");
        
        hasClaimed[_marketId][msg.sender] = true;
        totalLockedAmount -= payout;
        
        usdcToken.safeTransfer(msg.sender, payout);
        emit PayoutClaimed(_marketId, msg.sender, payout);
    }
    
    /**
     * @notice [ECR-002] Distributes fees for a single user's bet (used in DRAW scenario)
     */
    function _distributeUserFees(uint256 betAmount, address creator, address referrer) internal {
        uint256 houseFee = (betAmount * houseFeeBps) / FEE_DENOMINATOR;
        uint256 creatorFee = (betAmount * creatorFeeBps) / FEE_DENOMINATOR;
        uint256 referrerFee = (betAmount * referrerFeeBps) / FEE_DENOMINATOR;
        
        houseBalance += houseFee;
        creatorBalance[creator] += creatorFee;
        
        if (referrer != address(0)) {
            rewardsBalance[referrer] += referrerFee;
        } else {
            houseBalance += referrerFee; // No referrer = house gets it
        }
    }

    function claimReporterReward(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(m.outcome != MarketOutcome.CANCELLED, "Market cancelled");
        require(msg.sender == m.proposer, "Not proposer");
        require(!reporterRewardClaimed[_marketId], "Already claimed");
        
        uint256 totalPool = m.totalYes + m.totalNo;
        uint256 reward = (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
        
        reporterRewardClaimed[_marketId] = true;
        totalLockedAmount -= reward;
        
        usdcToken.safeTransfer(msg.sender, reward);
        emit ReporterRewardClaimed(_marketId, msg.sender, reward);
    }

    function voidMarket(string calldata _marketId) external nonReentrant {
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

    function voidAbandonedMarket(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.OPEN || m.state == MarketState.LOCKED, "Invalid state");
        require(block.timestamp > m.deadlineTime + 30 days, "Not abandoned");
        
        _updateMarketState(m, MarketState.RESOLVED);
        m.outcome = MarketOutcome.CANCELLED;
        
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

    function claimFallback(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(m.outcome == MarketOutcome.YES || m.outcome == MarketOutcome.NO, "Invalid outcome");
        
        uint256 totalWinningShares = (m.outcome == MarketOutcome.YES) ? m.totalSharesYes : m.totalSharesNo;
        require(totalWinningShares == 0, "Winners exist");

        require(msg.sender == m.creator, "Only creator");
        require(!hasClaimed[_marketId][msg.sender], "Already claimed");
        
        uint256 totalPool = m.totalYes + m.totalNo;
        
        // Calculate and distribute fees
        uint256 totalFeesBps = houseFeeBps + creatorFeeBps + referrerFeeBps + REPORTER_REWARD_BPS;
        uint256 totalFeeAmount = (totalPool * totalFeesBps) / FEE_DENOMINATOR;
        uint256 payout = totalPool - totalFeeAmount;
        
        // Distribute fees to balances (no referrer in fallback, goes to house)
        uint256 houseFee = (totalPool * (houseFeeBps + referrerFeeBps)) / FEE_DENOMINATOR; // House gets referrer portion
        uint256 creatorFee = (totalPool * creatorFeeBps) / FEE_DENOMINATOR;
        // Reporter reward is claimed separately via claimReporterReward
        
        houseBalance += houseFee;
        creatorBalance[m.creator] += creatorFee;
        
        hasClaimed[_marketId][msg.sender] = true;
        totalLockedAmount -= payout;
        
        usdcToken.safeTransfer(msg.sender, payout);
        emit PayoutClaimed(_marketId, msg.sender, payout);
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
