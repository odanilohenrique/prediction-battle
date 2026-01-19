// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionBattleV3
 * @dev Decentralized Verification Protocol (Optimistic Oracle)
 * 
 * Features:
 * - Time-weighted shares (1.5x → 1.0x decay)
 * - Viral referral system (5% to referrer if valid)
 * - Dead liquidity (seed) that doesn't generate shares
 * - USDC (6 decimals) with shares precision (18 decimals)
 * - Decentralized verification with bonding (5% of pool)
 * - Dispute system with smart reset
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract PredictionBattleV3 {
    // ============ Constants ============
    uint256 public constant SHARE_PRECISION = 1e18;
    uint256 public constant FEE_DENOMINATOR = 10000; // Basis points
    uint256 public constant MAX_WEIGHT = 150; // 1.5x
    uint256 public constant MIN_WEIGHT = 100; // 1.0x
    
    // V3: Verification Constants
    uint256 public constant BOND_PERCENT = 500;        // 5% of pool (in basis points)
    uint256 public constant REPORTER_REWARD_BPS = 100; // 1% of pool to honest reporter
    uint256 public constant DISPUTE_WINDOW = 12 hours;
    uint256 public constant MIN_BOND = 1e6;            // 1 USDC minimum bond

    // ============ Enums ============
    enum MarketState {
        OPEN,      // Accepting bets
        LOCKED,    // Deadline passed, awaiting outcome report
        PROPOSED,  // Outcome reported, in dispute window
        RESOLVED   // Final state
    }

    // ============ State ============
    address public admin;
    IERC20 public usdcToken;
    
    // Fee Structure (in basis points, totaling 2000 = 20%)
    uint256 public houseFeeBps = 1000;   // 10% default (15% if no referrer)
    uint256 public creatorFeeBps = 500;  // 5%
    uint256 public referrerFeeBps = 500; // 5%
    
    // ============ Structs ============
    struct Market {
        string id;
        address creator;
        string question;
        uint256 creationTime;
        uint256 bonusDuration;    // Duration for weight decay
        uint256 deadline;
        MarketState state;        // V3: State machine
        bool result;              // true = YES wins, false = NO wins
        bool isVoid;
        bool paidOut;
        uint256 processedIndex;
        
        // V3: Proposal Tracking
        address proposer;
        bool proposedResult;
        uint256 proposalTime;
        uint256 bondAmount;
        string evidenceUrl; // V3.1: Evidence link
        
        // Pool Tracking (USDC - 6 decimals)
        uint256 totalYes;
        uint256 totalNo;
        uint256 seedYes;          // Dead liquidity
        uint256 seedNo;
        
        // Share Tracking (18 decimals precision)
        uint256 totalSharesYes;
        uint256 totalSharesNo;
        
        // Bettor Lists
        address[] yesBettors;
        address[] noBettors;
    }
    
    struct UserBet {
        uint256 amount;      // USDC amount
        uint256 shares;      // Share amount (1e18 precision)
        address referrer;
        bool claimed;
    }
    
    // ============ Mappings ============
    mapping(string => Market) public markets;
    mapping(string => bool) public marketExists;
    mapping(string => mapping(address => UserBet)) public yesBets;
    mapping(string => mapping(address => UserBet)) public noBets;
    
    // Accumulated rewards (USDC - 6 decimals)
    mapping(address => uint256) public rewardsBalance;  // For referrers
    mapping(address => uint256) public creatorBalance;  // For creators
    mapping(address => uint256) public bondBalance;     // V3: For proposers' locked bonds
    uint256 public houseBalance;
    
    // Operators
    mapping(address => bool) public operators;
    
    // ============ Events ============
    event MarketCreated(string indexed id, address indexed creator, uint256 deadline, uint256 bonusDuration);
    event SeedAdded(string indexed id, uint256 yesAmount, uint256 noAmount);
    event BetPlaced(string indexed id, address indexed user, bool vote, uint256 amount, uint256 shares, address referrer, uint256 weight);
    event MarketResolved(string indexed id, bool result, uint256 winnerPool);
    event MarketVoided(string indexed id);
    event RewardClaimed(string indexed id, address indexed user, uint256 amount);
    event ReferralRewardClaimed(address indexed user, uint256 amount);
    event CreatorRewardClaimed(address indexed user, uint256 amount);
    event HouseWithdraw(address indexed admin, uint256 amount);
    event OperatorUpdated(address indexed operator, bool status);
    
    // V3 Events
    event OutcomeProposed(string indexed id, address indexed proposer, bool proposedResult, uint256 bondAmount, uint256 disputeDeadline, string evidenceUrl);
    event OutcomeDisputed(string indexed id, address indexed disputer, address indexed slashedProposer, uint256 slashedAmount);
    event OutcomeFinalized(string indexed id, address indexed proposer, uint256 rewardAmount);
    event MarketLocked(string indexed id);
    event MarketReopened(string indexed id);
    
    // ============ Modifiers ============
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    modifier onlyAdminOrOperator() {
        require(msg.sender == admin || operators[msg.sender], "Not authorized");
        _;
    }
    
    // ============ Constructor ============
    constructor(address _usdcAddress) {
        admin = msg.sender;
        usdcToken = IERC20(_usdcAddress);
    }
    
    // ============ Admin Functions ============
    function setOperator(address _operator, bool _status) external onlyAdmin {
        operators[_operator] = _status;
        emit OperatorUpdated(_operator, _status);
    }
    
    function setAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid address");
        admin = _newAdmin;
    }
    
    function updateFees(uint256 _houseFeeBps, uint256 _creatorFeeBps, uint256 _referrerFeeBps) external onlyAdmin {
        require(_houseFeeBps + _creatorFeeBps + _referrerFeeBps <= 3000, "Total fees too high");
        houseFeeBps = _houseFeeBps;
        creatorFeeBps = _creatorFeeBps;
        referrerFeeBps = _referrerFeeBps;
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Create a new prediction market with USDC seed
     */
    function createMarket(
        string memory _id,
        string memory _question,
        uint256 _usdcSeedAmount,
        uint256 _duration,
        uint256 _bonusDuration
    ) external {
        require(!marketExists[_id], "Market already exists");
        require(_usdcSeedAmount > 0 && _usdcSeedAmount % 2 == 0, "Seed must be > 0 and even");
        require(_duration > 0, "Duration must be > 0");
        
        // Transfer USDC seed from creator
        require(usdcToken.transferFrom(msg.sender, address(this), _usdcSeedAmount), "USDC transfer failed");
        
        Market storage m = markets[_id];
        m.id = _id;
        m.creator = msg.sender;
        m.question = _question;
        m.creationTime = block.timestamp;
        m.bonusDuration = _bonusDuration > 0 ? _bonusDuration : _duration;
        m.deadline = block.timestamp + _duration;
        m.state = MarketState.OPEN;  // V3: Start as OPEN
        
        // Split seed 50/50 as dead liquidity
        uint256 seedPerSide = _usdcSeedAmount / 2;
        m.totalYes = seedPerSide;
        m.totalNo = seedPerSide;
        m.seedYes = seedPerSide;
        m.seedNo = seedPerSide;
        
        marketExists[_id] = true;
        
        emit MarketCreated(_id, msg.sender, m.deadline, _bonusDuration);
        emit SeedAdded(_id, seedPerSide, seedPerSide);
    }
    
    /**
     * @notice Place a bet on a market
     */
    function placeBet(
        string memory _marketId,
        bool _side,
        uint256 _usdcAmount,
        address _referrer
    ) external {
        require(marketExists[_marketId], "Market does not exist");
        Market storage m = markets[_marketId];
        
        // V3: Check state instead of just deadline
        require(m.state == MarketState.OPEN, "Market not accepting bets");
        require(block.timestamp < m.deadline, "Betting closed");
        require(_usdcAmount > 0, "Amount must be > 0");
        
        // Transfer USDC from user
        require(usdcToken.transferFrom(msg.sender, address(this), _usdcAmount), "USDC transfer failed");
        
        // Calculate fees (20% total)
        (uint256 houseFee, uint256 creatorFee, uint256 referrerFee) = _calculateFees(_usdcAmount, _referrer, msg.sender);
        
        // Distribute fees to internal balances
        houseBalance += houseFee;
        creatorBalance[m.creator] += creatorFee;
        if (_referrer != address(0) && _referrer != msg.sender) {
            rewardsBalance[_referrer] += referrerFee;
        }
        
        // Net bet amount (80%)
        uint256 netBet = _usdcAmount - houseFee - creatorFee - referrerFee;
        
        // Calculate time-weighted shares
        uint256 currentWeight = _calculateWeight(m.creationTime, m.bonusDuration);
        uint256 shares = (netBet * currentWeight * SHARE_PRECISION) / 100;
        
        // Record bet
        if (_side) {
            if (yesBets[_marketId][msg.sender].amount == 0) {
                m.yesBettors.push(msg.sender);
            }
            yesBets[_marketId][msg.sender].amount += netBet;
            yesBets[_marketId][msg.sender].shares += shares;
            yesBets[_marketId][msg.sender].referrer = _referrer;
            
            m.totalYes += netBet;
            m.totalSharesYes += shares;
        } else {
            if (noBets[_marketId][msg.sender].amount == 0) {
                m.noBettors.push(msg.sender);
            }
            noBets[_marketId][msg.sender].amount += netBet;
            noBets[_marketId][msg.sender].shares += shares;
            noBets[_marketId][msg.sender].referrer = _referrer;
            
            m.totalNo += netBet;
            m.totalSharesNo += shares;
        }
        
        emit BetPlaced(_marketId, msg.sender, _side, _usdcAmount, shares, _referrer, currentWeight);
    }
    
    /**
     * @notice Auto-lock market when deadline passes (can be called by anyone)
     */
    function lockMarket(string memory _marketId) external {
        require(marketExists[_marketId], "Market does not exist");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.OPEN, "Market not open");
        require(block.timestamp >= m.deadline, "Deadline not reached");
        
        m.state = MarketState.LOCKED;
        emit MarketLocked(_marketId);
    }
    
    // ============ V3: Decentralized Verification ============
    
    /**
     * @notice Calculate required bond amount (5% of pool, min 1 USDC)
     */
    function getRequiredBond(string memory _marketId) public view returns (uint256) {
        Market storage m = markets[_marketId];
        uint256 totalPool = m.totalYes + m.totalNo;
        uint256 calculatedBond = (totalPool * BOND_PERCENT) / FEE_DENOMINATOR;
        return calculatedBond > MIN_BOND ? calculatedBond : MIN_BOND;
    }
    
    /**
     * @notice Get reporter reward (1% of pool)
     */
    function getReporterReward(string memory _marketId) public view returns (uint256) {
        Market storage m = markets[_marketId];
        uint256 totalPool = m.totalYes + m.totalNo;
        return (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
    }
    
    /**
     * @notice Propose an outcome (anyone can call, requires bond)
     * @param _marketId The market to report on
     * @param _result The proposed result (true = YES, false = NO)
     * @param _evidenceUrl Link to proof (image/post)
     */
    function proposeOutcome(string memory _marketId, bool _result, string memory _evidenceUrl) external {
        require(marketExists[_marketId], "Market does not exist");
        Market storage m = markets[_marketId];
        
        // V3: Can propose if OPEN (early resolution) or LOCKED (after deadline)
        require(m.state == MarketState.OPEN || m.state == MarketState.LOCKED, "Market not active");
        
        uint256 bondAmount = getRequiredBond(_marketId);
        
        // Transfer bond from proposer
        require(usdcToken.transferFrom(msg.sender, address(this), bondAmount), "Bond transfer failed");
        
        // Record proposal
        m.proposer = msg.sender;
        m.proposedResult = _result;
        m.proposalTime = block.timestamp;
        m.bondAmount = bondAmount;
        m.evidenceUrl = _evidenceUrl;
        m.state = MarketState.PROPOSED;
        
        // Store bond in proposer's locked balance (for tracking)
        bondBalance[msg.sender] += bondAmount;
        
        emit OutcomeProposed(_marketId, msg.sender, _result, bondAmount, block.timestamp + DISPUTE_WINDOW, _evidenceUrl);
    }
    
    /**
     * @notice Dispute a proposed outcome (Admin only in V3)
     * @dev Slashes the proposer's bond and resets market state
     */
    function disputeOutcome(string memory _marketId) external onlyAdminOrOperator {
        require(marketExists[_marketId], "Market does not exist");
        Market storage m = markets[_marketId];
        
        require(m.state == MarketState.PROPOSED, "No active proposal");
        require(block.timestamp <= m.proposalTime + DISPUTE_WINDOW, "Dispute window closed");
        
        address slashedProposer = m.proposer;
        uint256 slashedAmount = m.bondAmount;
        
        // Slash the bond (send to house)
        bondBalance[slashedProposer] -= slashedAmount;
        houseBalance += slashedAmount;
        
        // Clear proposal
        m.proposer = address(0);
        m.proposedResult = false;
        m.proposalTime = 0;
        m.bondAmount = 0;
        m.evidenceUrl = "";
        
        // Smart Reset: Check if deadline passed or not
        if (block.timestamp < m.deadline) {
            // Deadline not reached: Reopen for betting
            m.state = MarketState.OPEN;
            emit MarketReopened(_marketId);
        } else {
            // Deadline passed: Lock for new report
            m.state = MarketState.LOCKED;
            emit MarketLocked(_marketId);
        }
        
        emit OutcomeDisputed(_marketId, msg.sender, slashedProposer, slashedAmount);
    }
    
    /**
     * @notice Finalize a proposed outcome after dispute window
     * @dev Anyone can call after 12h if no dispute occurred
     */
    function finalizeOutcome(string memory _marketId) external {
        require(marketExists[_marketId], "Market does not exist");
        Market storage m = markets[_marketId];
        
        require(m.state == MarketState.PROPOSED, "No active proposal");
        require(block.timestamp > m.proposalTime + DISPUTE_WINDOW, "Dispute window active");
        
        address proposer = m.proposer;
        uint256 bondAmount = m.bondAmount;
        
        // Return bond to proposer
        bondBalance[proposer] -= bondAmount;
        require(usdcToken.transfer(proposer, bondAmount), "Bond return failed");
        
        // Calculate and pay reporter reward (1% of pool)
        uint256 reward = getReporterReward(_marketId);
        if (reward > 0 && houseBalance >= reward) {
            // Reward comes from house fees
            houseBalance -= reward;
            require(usdcToken.transfer(proposer, reward), "Reward transfer failed");
        }
        
        // Resolve market
        m.state = MarketState.RESOLVED;
        m.result = m.proposedResult;
        
        emit OutcomeFinalized(_marketId, proposer, reward);
        emit MarketResolved(_marketId, m.result, m.result ? m.totalYes : m.totalNo);
    }
    
    /**
     * @notice Admin can still force-resolve in emergencies
     */
    function adminResolve(string memory _marketId, bool _result) external onlyAdmin {
        require(marketExists[_marketId], "Market does not exist");
        Market storage m = markets[_marketId];
        require(m.state != MarketState.RESOLVED, "Already resolved");
        
        // If there's an active proposal, return the bond first
        if (m.state == MarketState.PROPOSED && m.bondAmount > 0) {
            address proposer = m.proposer;
            uint256 bondAmount = m.bondAmount;
            bondBalance[proposer] -= bondAmount;
            require(usdcToken.transfer(proposer, bondAmount), "Bond return failed");
        }
        
        m.state = MarketState.RESOLVED;
        m.result = _result;
        
        emit MarketResolved(_marketId, _result, _result ? m.totalYes : m.totalNo);
    }
    
    /**
     * @notice Void a market (refund mode)
     */
    function voidMarket(string memory _marketId) external onlyAdminOrOperator {
        require(marketExists[_marketId], "Market does not exist");
        Market storage m = markets[_marketId];
        require(m.state != MarketState.RESOLVED, "Already resolved");
        
        // If there's an active proposal, return the bond first
        if (m.state == MarketState.PROPOSED && m.bondAmount > 0) {
            address proposer = m.proposer;
            uint256 bondAmount = m.bondAmount;
            bondBalance[proposer] -= bondAmount;
            require(usdcToken.transfer(proposer, bondAmount), "Bond return failed");
        }
        
        m.state = MarketState.RESOLVED;
        m.isVoid = true;
        
        emit MarketVoided(_marketId);
    }
    
    // ============ Claim Functions ============
    
    /**
     * @notice Claim reward from a resolved market
     */
    function claimReward(string memory _marketId) external {
        require(marketExists[_marketId], "Market does not exist");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved yet");
        
        uint256 payout = 0;
        
        if (m.isVoid) {
            // Void: Return original bet amounts
            uint256 yesAmount = yesBets[_marketId][msg.sender].amount;
            uint256 noAmount = noBets[_marketId][msg.sender].amount;
            
            require(!yesBets[_marketId][msg.sender].claimed && !noBets[_marketId][msg.sender].claimed, "Already claimed");
            
            payout = yesAmount + noAmount;
            yesBets[_marketId][msg.sender].claimed = true;
            noBets[_marketId][msg.sender].claimed = true;
        } else {
            // Normal: Pay based on shares
            if (m.result) {
                UserBet storage bet = yesBets[_marketId][msg.sender];
                require(!bet.claimed, "Already claimed");
                require(bet.shares > 0, "No winning bet");
                
                uint256 totalPool = m.totalYes + m.totalNo;
                payout = (bet.shares * totalPool) / m.totalSharesYes;
                bet.claimed = true;
            } else {
                UserBet storage bet = noBets[_marketId][msg.sender];
                require(!bet.claimed, "Already claimed");
                require(bet.shares > 0, "No winning bet");
                
                uint256 totalPool = m.totalYes + m.totalNo;
                payout = (bet.shares * totalPool) / m.totalSharesNo;
                bet.claimed = true;
            }
        }
        
        require(payout > 0, "Nothing to claim");
        require(usdcToken.transfer(msg.sender, payout), "Transfer failed");
        
        emit RewardClaimed(_marketId, msg.sender, payout);
    }
    
    /**
     * @notice Claim accumulated referral rewards
     */
    function claimReferralRewards() external {
        uint256 amount = rewardsBalance[msg.sender];
        require(amount > 0, "No rewards");
        
        rewardsBalance[msg.sender] = 0;
        require(usdcToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit ReferralRewardClaimed(msg.sender, amount);
    }
    
    /**
     * @notice Claim accumulated creator rewards
     */
    function claimCreatorRewards() external {
        uint256 amount = creatorBalance[msg.sender];
        require(amount > 0, "No rewards");
        
        creatorBalance[msg.sender] = 0;
        require(usdcToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit CreatorRewardClaimed(msg.sender, amount);
    }
    
    /**
     * @notice Admin withdraws house balance
     */
    function withdrawHouseBalance() external onlyAdmin {
        uint256 amount = houseBalance;
        require(amount > 0, "No balance");
        
        houseBalance = 0;
        require(usdcToken.transfer(admin, amount), "Transfer failed");
        
        emit HouseWithdraw(admin, amount);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get current weight multiplier
     */
    function getCurrentWeight(string memory _marketId) external view returns (uint256) {
        Market storage m = markets[_marketId];
        return _calculateWeight(m.creationTime, m.bonusDuration);
    }
    
    /**
     * @notice Get market info (V3: includes state)
     */
    function getMarketInfo(string memory _marketId) external view returns (
        address creator,
        uint256 deadline,
        MarketState state,
        bool result,
        uint256 totalYes,
        uint256 totalNo,
        uint256 totalSharesYes,
        uint256 totalSharesNo
    ) {
        Market storage m = markets[_marketId];
        return (
            m.creator,
            m.deadline,
            m.state,
            m.result,
            m.totalYes,
            m.totalNo,
            m.totalSharesYes,
            m.totalSharesNo
        );
    }
    
    /**
     * @notice Get proposal info (V3)
     */
    function getProposalInfo(string memory _marketId) external view returns (
        address proposer,
        bool proposedResult,
        uint256 proposalTime,
        uint256 bondAmount,
        uint256 disputeDeadline,
        bool canFinalize,
        string memory evidenceUrl
    ) {
        Market storage m = markets[_marketId];
        uint256 deadline = m.proposalTime > 0 ? m.proposalTime + DISPUTE_WINDOW : 0;
        bool finalizeable = m.state == MarketState.PROPOSED && block.timestamp > deadline;
        return (
            m.proposer,
            m.proposedResult,
            m.proposalTime,
            m.bondAmount,
            deadline,
            finalizeable,
            m.evidenceUrl
        );
    }
    
    /**
     * @notice Get user bet info
     */
    function getUserBet(string memory _marketId, address _user, bool _side) external view returns (
        uint256 amount,
        uint256 shares,
        address referrer,
        bool claimed
    ) {
        if (_side) {
            UserBet storage bet = yesBets[_marketId][_user];
            return (bet.amount, bet.shares, bet.referrer, bet.claimed);
        } else {
            UserBet storage bet = noBets[_marketId][_user];
            return (bet.amount, bet.shares, bet.referrer, bet.claimed);
        }
    }
    
    /**
     * @notice Estimate payout for a potential bet
     */
    function estimatePayout(
        string memory _marketId,
        bool _side,
        uint256 _usdcAmount
    ) external view returns (uint256 estimatedShares, uint256 estimatedPayout) {
        Market storage m = markets[_marketId];
        
        uint256 netBet = (_usdcAmount * 8000) / FEE_DENOMINATOR;
        uint256 currentWeight = _calculateWeight(m.creationTime, m.bonusDuration);
        estimatedShares = (netBet * currentWeight * SHARE_PRECISION) / 100;
        
        uint256 totalPool = m.totalYes + m.totalNo + netBet;
        uint256 totalShares;
        
        if (_side) {
            totalShares = m.totalSharesYes + estimatedShares;
        } else {
            totalShares = m.totalSharesNo + estimatedShares;
        }
        
        if (totalShares > 0) {
            estimatedPayout = (estimatedShares * totalPool) / totalShares;
        }
    }
    
    // ============ Internal Functions ============
    
    function _calculateWeight(uint256 _creationTime, uint256 _bonusDuration) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - _creationTime;
        
        if (elapsed >= _bonusDuration) {
            return MIN_WEIGHT;
        }
        
        uint256 decay = ((MAX_WEIGHT - MIN_WEIGHT) * elapsed) / _bonusDuration;
        return MAX_WEIGHT - decay;
    }
    
    function _calculateFees(
        uint256 _amount,
        address _referrer,
        address _bettor
    ) internal view returns (uint256 houseFee, uint256 creatorFee, uint256 referrerFee) {
        creatorFee = (_amount * creatorFeeBps) / FEE_DENOMINATOR;
        
        if (_referrer != address(0) && _referrer != _bettor) {
            houseFee = (_amount * houseFeeBps) / FEE_DENOMINATOR;
            referrerFee = (_amount * referrerFeeBps) / FEE_DENOMINATOR;
        } else {
            houseFee = (_amount * (houseFeeBps + referrerFeeBps)) / FEE_DENOMINATOR;
            referrerFee = 0;
        }
    }
}
