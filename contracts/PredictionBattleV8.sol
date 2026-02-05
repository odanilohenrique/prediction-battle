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
    
    // ============ STRUCTS ============
    
    struct Market {
        string id;
        address creator;
        string question;
        uint256 creationTime;     
        uint256 bonusDuration;    
        uint256 deadlineTime;     
        MarketState state;
        bool result;
        bool isVoid;
        
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
        
        // Fee Deduction (Entry side)
        uint256 houseFee = (_usdcAmount * houseFeeBps) / FEE_DENOMINATOR;
        uint256 creatorFee = (_usdcAmount * creatorFeeBps) / FEE_DENOMINATOR;
        uint256 referrerFee = 0;
        
        if (_referrer != address(0) && _referrer != m.creator) {
            referrerFee = (_usdcAmount * referrerFeeBps) / FEE_DENOMINATOR;
            rewardsBalance[_referrer] += referrerFee;
        }
        
        uint256 netAmount = _usdcAmount - houseFee - creatorFee - referrerFee;
        
        houseBalance += houseFee;
        creatorBalance[m.creator] += creatorFee;
        
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
        address _winnerAddress,
        bool _finalResult
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
        m.result = _finalResult;
        m.bondAmount = 0;
        m.challengeBondAmount = 0;
        
        emit DisputeResolved(_marketId, _winnerAddress, totalBond, _finalResult);
        emit MarketResolved(_marketId, _finalResult, _finalResult ? m.totalYes : m.totalNo);
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
        m.isVoid = true; // Auto-void
        
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
        m.result = m.proposedResult;
        m.bondAmount = 0;
        
        emit OutcomeFinalized(_marketId, proposer, 0); // reward=0 here, claimed separately
        emit MarketResolved(_marketId, m.result, m.result ? m.totalYes : m.totalNo);
    }

    // ============ CLAIMS & WITHDRAWALS ============

    /**
     * @notice Implements C-01 Fix: No double taxation.
     */
    function claimWinnings(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(!hasClaimed[_marketId][msg.sender], "Already claimed");
        
        uint256 payout = 0;
        UserBet storage yesBet = yesBets[_marketId][msg.sender];
        UserBet storage noBet = noBets[_marketId][msg.sender];
        
        if (m.isVoid) {
            payout = yesBet.amount + noBet.amount;
        } else {
            bool isYesWinner = m.result;
            UserBet storage winningBet = isYesWinner ? yesBet : noBet;
            
            if (winningBet.amount > 0 && winningBet.shares > 0) {
                uint256 totalPool = m.totalYes + m.totalNo;
                require(totalPool > 0, "Empty pool");
                
                // [C-01 FIX] Deduct 1% for reporter reward.
                // This 1% is held in the contract for the proposer to claim via claimReporterReward().
                uint256 reporterReward = (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
                uint256 distributablePool = totalPool - reporterReward;
                
                uint256 totalWinningShares = isYesWinner ? m.totalSharesYes : m.totalSharesNo;
                require(totalWinningShares > 0, "No winning shares");
                
                payout = (winningBet.shares * distributablePool) / totalWinningShares;
            }
        }
        
        require(payout > 0, "Nothing to claim");
        
        hasClaimed[_marketId][msg.sender] = true;
        // [L-02 Fix] No boolean update in struct
        
        usdcToken.safeTransfer(msg.sender, payout);
        emit PayoutClaimed(_marketId, msg.sender, payout);
    }

    /**
     * @notice [C-01 FIX] Allows the proposer to claim their 1% reporter reward.
     * @dev Can only be called after market is resolved (not voided).
     */
    function claimReporterReward(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(!m.isVoid, "Market voided");
        require(msg.sender == m.proposer, "Not proposer");
        require(!reporterRewardClaimed[_marketId], "Already claimed");
        
        uint256 totalPool = m.totalYes + m.totalNo;
        uint256 reward = (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
        
        reporterRewardClaimed[_marketId] = true;
        
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
        m.isVoid = true;
        emit MarketVoided(_marketId);
    }

    function withdrawSeed(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(m.isVoid, "Not void");
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
        usdcToken.safeTransfer(msg.sender, amount);
        emit BondWithdrawn(msg.sender, amount);
    }
    
    function withdrawCreatorFees() external nonReentrant {
        uint256 amount = creatorBalance[msg.sender];
        require(amount > 0, "No fees");
        creatorBalance[msg.sender] = 0;
        usdcToken.safeTransfer(msg.sender, amount);
    }
    
    function withdrawReferrerFees() external nonReentrant {
        uint256 amount = rewardsBalance[msg.sender];
        require(amount > 0, "No fees");
        rewardsBalance[msg.sender] = 0;
        usdcToken.safeTransfer(msg.sender, amount);
    }
    
    function withdrawHouseFees() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 amount = houseBalance;
        require(amount > 0, "No fees");
        houseBalance = 0;
        usdcToken.safeTransfer(treasury, amount);
        emit HouseFeeWithdrawn(treasury, amount);
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
        MarketState state, bool result, uint256 totalYes, uint256 totalNo, uint256 deadlineTime, address creator, bool isVoid
    ) {
        Market storage m = markets[_marketId];
        return (m.state, m.result, m.totalYes, m.totalNo, m.deadlineTime, m.creator, m.isVoid);
    }
}
