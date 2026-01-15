// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionBattleV2
 * @dev Viral Boosted Parimutuel prediction market using USDC (ERC20).
 * 
 * Features:
 * - Time-weighted shares (1.5x → 1.0x decay)
 * - Viral referral system (5% to referrer if valid)
 * - Dead liquidity (seed) that doesn't generate shares
 * - USDC (6 decimals) with shares precision (18 decimals)
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract PredictionBattleV2 {
    // ============ Constants ============
    uint256 public constant SHARE_PRECISION = 1e18;
    uint256 public constant FEE_DENOMINATOR = 10000; // Basis points
    uint256 public constant MAX_WEIGHT = 150; // 1.5x
    uint256 public constant MIN_WEIGHT = 100; // 1.0x

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
        bool resolved;
        bool result;              // true = YES wins, false = NO wins
        bool isVoid;
        bool paidOut;
        uint256 processedIndex;
        
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
     * @param _id Unique market identifier
     * @param _question Market question (for reference)
     * @param _usdcSeedAmount Initial seed (will be split 50/50)
     * @param _duration Time until betting closes
     * @param _bonusDuration Time period for weight decay (e.g., first 6 hours)
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
        m.bonusDuration = _bonusDuration > 0 ? _bonusDuration : _duration; // Default to full duration
        m.deadline = block.timestamp + _duration;
        
        // Split seed 50/50 as dead liquidity
        uint256 seedPerSide = _usdcSeedAmount / 2;
        m.totalYes = seedPerSide;
        m.totalNo = seedPerSide;
        m.seedYes = seedPerSide;
        m.seedNo = seedPerSide;
        // Seed does NOT generate shares
        
        marketExists[_id] = true;
        
        emit MarketCreated(_id, msg.sender, m.deadline, _bonusDuration);
        emit SeedAdded(_id, seedPerSide, seedPerSide);
    }
    
    /**
     * @notice Place a bet on a market
     * @param _marketId Market ID
     * @param _side true = YES, false = NO
     * @param _usdcAmount Amount of USDC to bet
     * @param _referrer Address of referrer (use address(0) if none)
     */
    function placeBet(
        string memory _marketId,
        bool _side,
        uint256 _usdcAmount,
        address _referrer
    ) external {
        require(marketExists[_marketId], "Market does not exist");
        Market storage m = markets[_marketId];
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
            // YES side
            if (yesBets[_marketId][msg.sender].amount == 0) {
                m.yesBettors.push(msg.sender);
            }
            yesBets[_marketId][msg.sender].amount += netBet;
            yesBets[_marketId][msg.sender].shares += shares;
            yesBets[_marketId][msg.sender].referrer = _referrer;
            
            m.totalYes += netBet;
            m.totalSharesYes += shares;
        } else {
            // NO side
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
     * @notice Resolve a market (admin/operator only)
     */
    function resolveMarket(string memory _marketId, bool _result) external onlyAdminOrOperator {
        require(marketExists[_marketId], "Market does not exist");
        Market storage m = markets[_marketId];
        require(!m.resolved, "Already resolved");
        
        m.resolved = true;
        m.result = _result;
        
        uint256 winnerPool = _result ? m.totalYes : m.totalNo;
        emit MarketResolved(_marketId, _result, winnerPool);
    }
    
    /**
     * @notice Void a market (refund mode)
     */
    function voidMarket(string memory _marketId) external onlyAdminOrOperator {
        require(marketExists[_marketId], "Market does not exist");
        Market storage m = markets[_marketId];
        require(!m.resolved, "Already resolved");
        
        m.resolved = true;
        m.isVoid = true;
        
        emit MarketVoided(_marketId);
    }
    
    /**
     * @notice Claim reward from a resolved market
     */
    function claimReward(string memory _marketId) external {
        require(marketExists[_marketId], "Market does not exist");
        Market storage m = markets[_marketId];
        require(m.resolved, "Not resolved yet");
        
        uint256 payout = 0;
        
        if (m.isVoid) {
            // Void: Return original bet amounts (minus seed)
            uint256 yesAmount = yesBets[_marketId][msg.sender].amount;
            uint256 noAmount = noBets[_marketId][msg.sender].amount;
            
            require(!yesBets[_marketId][msg.sender].claimed && !noBets[_marketId][msg.sender].claimed, "Already claimed");
            
            payout = yesAmount + noAmount;
            yesBets[_marketId][msg.sender].claimed = true;
            noBets[_marketId][msg.sender].claimed = true;
        } else {
            // Normal: Pay based on shares
            if (m.result) {
                // YES won
                UserBet storage bet = yesBets[_marketId][msg.sender];
                require(!bet.claimed, "Already claimed");
                require(bet.shares > 0, "No winning bet");
                
                // Total distributable = totalYes + totalNo (after fees were taken during betting)
                uint256 totalPool = m.totalYes + m.totalNo;
                // User's share of the pool
                payout = (bet.shares * totalPool) / m.totalSharesYes;
                bet.claimed = true;
            } else {
                // NO won
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
     * @notice Get current weight multiplier (in basis: 100 = 1.0x, 150 = 1.5x)
     */
    function getCurrentWeight(string memory _marketId) external view returns (uint256) {
        Market storage m = markets[_marketId];
        return _calculateWeight(m.creationTime, m.bonusDuration);
    }
    
    /**
     * @notice Get market info
     */
    function getMarketInfo(string memory _marketId) external view returns (
        address creator,
        uint256 deadline,
        bool resolved,
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
            m.resolved,
            m.result,
            m.totalYes,
            m.totalNo,
            m.totalSharesYes,
            m.totalSharesNo
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
        
        // Calculate net bet (80%)
        uint256 netBet = (_usdcAmount * 8000) / FEE_DENOMINATOR;
        
        // Calculate shares
        uint256 currentWeight = _calculateWeight(m.creationTime, m.bonusDuration);
        estimatedShares = (netBet * currentWeight * SHARE_PRECISION) / 100;
        
        // Estimate payout assuming this bet goes through
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
            return MIN_WEIGHT; // 1.0x
        }
        
        // Linear decay from 150 to 100 over bonusDuration
        // weight = MAX_WEIGHT - ((MAX_WEIGHT - MIN_WEIGHT) * elapsed / bonusDuration)
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
            // Valid referrer: split as defined
            houseFee = (_amount * houseFeeBps) / FEE_DENOMINATOR;
            referrerFee = (_amount * referrerFeeBps) / FEE_DENOMINATOR;
        } else {
            // No referrer: house gets referrer's share too
            houseFee = (_amount * (houseFeeBps + referrerFeeBps)) / FEE_DENOMINATOR;
            referrerFee = 0;
        }
    }
}
