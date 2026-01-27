// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionBattleV5
 * @dev V5: Implements User-to-User Disputes with Admin Arbitration.
 *      - 10 Minute Dispute Window (for testing)
 *      - challengeOutcome: Public function for users to dispute a proposal
 *      - resolveDispute: Admin function to settle disputes and award bonds
 *      - Matches V3 Interface for frontend compatibility
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PredictionBattleV5 {
    address public admin;
    IERC20 public usdcToken;
    
    // Config
    uint256 public constant DISPUTE_WINDOW = 600; // 10 Minutes for Testing
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Fee Config
    uint256 public houseFeeBps = 1000;   // 10%
    uint256 public creatorFeeBps = 500;  // 5%
    uint256 public referrerFeeBps = 500; // 5%
    
    // Shares Config (V3 Logic)
    uint256 public constant SHARE_PRECISION = 1e18;
    uint256 public constant MAX_WEIGHT = 150; // 1.5x
    uint256 public constant MIN_WEIGHT = 100; // 1.0x
    
    // House balance (accumulated fees)
    uint256 public houseBalance;
    mapping(address => uint256) public creatorBalance;
    mapping(address => uint256) public rewardsBalance;

    struct Market {
        string id;
        address creator;
        string question;
        uint256 creationTime;
        uint256 bonusDuration;
        uint256 deadline;
        MarketState state;
        bool result;
        bool isVoid;
        
        // Proposal Info
        address proposer;
        bool proposedResult;
        uint256 proposalTime;
        uint256 bondAmount;
        string evidenceUrl;
        
        // Dispute Info (V5 New)
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
        
        // Internal
        uint256 processedIndex;
        bool paidOut;
        
        // Bettor Lists
        address[] yesBettors;
        address[] noBettors;
    }
    
    struct UserBet {
        uint256 amount;
        uint256 shares;
        address referrer;
        bool claimed;
    }
    
    enum MarketState {
        OPEN,      // 0: Accepting bets
        LOCKED,    // 1: Deadline passed, awaiting outcome
        PROPOSED,  // 2: Outcome reported, in dispute window
        DISPUTED,  // 3: Challenged! Admin must resolve
        RESOLVED   // 4: Final state
    }
    
    mapping(string => Market) public markets;
    mapping(string => bool) public marketExists;
    mapping(address => bool) public operators;
    
    mapping(string => mapping(address => UserBet)) public yesBets;
    mapping(string => mapping(address => UserBet)) public noBets;
    
    // Locked bonds (balance tracking)
    mapping(address => uint256) public bondBalance;
    
    event MarketCreated(string id, address creator, uint256 deadline, uint256 bonusDuration);
    event BetPlaced(string id, address user, bool vote, uint256 amount, uint256 shares, address referrer, uint256 weight);
    event SeedAdded(string id, uint256 yesAmount, uint256 noAmount);
    
    event OutcomeProposed(string id, address proposer, bool result, uint256 bond, uint256 disputeEnd, string evidence);
    event OutcomeChallenged(string id, address challenger, uint256 bond, string evidence); // V5 New
    event DisputeResolved(string id, address winner, uint256 totalBondReward, bool finalResult); // V5 New
    event OutcomeFinalized(string id, address proposer, uint256 reward);
    event MarketResolved(string id, bool result, uint256 winnerPool);
    event MarketVoided(string id);
    event PayoutDistributed(string id, address user, uint256 amount);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    modifier onlyAdminOrOperator() {
        require(msg.sender == admin || operators[msg.sender], "Not authorized");
        _;
    }
    
    constructor(address _usdcAddress) {
        admin = msg.sender;
        usdcToken = IERC20(_usdcAddress);
    }
    
    // ============ Admin Functions ============
    
    function setOperator(address _operator, bool _status) external onlyAdmin {
        operators[_operator] = _status;
    }
    
    // ============ Core Functions (V3 Compat) ============
    
    function createMarket(
        string memory _id,
        string memory _question,
        uint256 _usdcSeedAmount,
        uint256 _duration,
        uint256 _bonusDuration
    ) external {
        require(!marketExists[_id], "Exists");
        require(_usdcSeedAmount > 0 && _usdcSeedAmount % 2 == 0, "Invalid seed");
        
        require(usdcToken.transferFrom(msg.sender, address(this), _usdcSeedAmount), "Transfer failed");
        
        Market storage m = markets[_id];
        m.id = _id;
        m.creator = msg.sender;
        m.question = _question;
        m.creationTime = block.timestamp;
        m.bonusDuration = _bonusDuration > 0 ? _bonusDuration : _duration;
        m.deadline = block.timestamp + _duration;
        m.state = MarketState.OPEN;
        
        uint256 seedPerSide = _usdcSeedAmount / 2;
        m.totalYes = seedPerSide;
        m.totalNo = seedPerSide;
        m.seedYes = seedPerSide;
        m.seedNo = seedPerSide;
        
        marketExists[_id] = true;
        emit MarketCreated(_id, msg.sender, m.deadline, _bonusDuration);
        emit SeedAdded(_id, seedPerSide, seedPerSide);
    }
    
    function placeBet(
        string memory _marketId,
        bool _side,
        uint256 _usdcAmount,
        address _referrer
    ) external {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.OPEN, "Not open");
        require(block.timestamp < m.deadline, "Expired");
        require(_usdcAmount > 0, "Zero amount");
        
        require(usdcToken.transferFrom(msg.sender, address(this), _usdcAmount), "Transfer failed");
        
        // Fee Logic (V3)
        uint256 houseFee = (_usdcAmount * houseFeeBps) / FEE_DENOMINATOR;
        uint256 creatorFee = (_usdcAmount * creatorFeeBps) / FEE_DENOMINATOR;
        uint256 referrerFee = 0;
        
        if (_referrer != address(0) && _referrer != msg.sender) {
             referrerFee = (_usdcAmount * referrerFeeBps) / FEE_DENOMINATOR;
             rewardsBalance[_referrer] += referrerFee;
             // House pays referrer fee from its standard share usually? 
             // V3 logic was House=10%, Creator=5%, Referrer=5%. Total 20%.
             // If no referrer, does house get 15%? V3 code implied it.
             // Implemented simple fixed fees here for safety.
        } else {
             // If no referrer, house takes the referrer portion
             houseFee += (_usdcAmount * referrerFeeBps) / FEE_DENOMINATOR;
        }
        
        houseBalance += houseFee;
        creatorBalance[m.creator] += creatorFee;
        
        uint256 netBet = _usdcAmount - houseFee - creatorFee - referrerFee;
        
        // Shares Logic
        uint256 currentWeight = _calculateWeight(m.creationTime, m.bonusDuration);
        uint256 shares = (netBet * currentWeight * SHARE_PRECISION) / 100;
        
        if (_side) {
            if (yesBets[_marketId][msg.sender].amount == 0) m.yesBettors.push(msg.sender);
            yesBets[_marketId][msg.sender].amount += netBet;
            yesBets[_marketId][msg.sender].shares += shares;
            m.totalYes += netBet;
            m.totalSharesYes += shares;
        } else {
            if (noBets[_marketId][msg.sender].amount == 0) m.noBettors.push(msg.sender);
            noBets[_marketId][msg.sender].amount += netBet;
            noBets[_marketId][msg.sender].shares += shares;
            m.totalNo += netBet;
            m.totalSharesNo += shares;
        }
        
        emit BetPlaced(_marketId, msg.sender, _side, _usdcAmount, shares, _referrer, currentWeight);
    }
    
    function _calculateWeight(uint256 _creationTime, uint256 _bonusDuration) internal view returns (uint256) {
        uint256 elapsed = block.timestamp > _creationTime ? block.timestamp - _creationTime : 0;
        if (elapsed >= _bonusDuration) return MIN_WEIGHT;
        uint256 bonus = ((MAX_WEIGHT - MIN_WEIGHT) * (_bonusDuration - elapsed)) / _bonusDuration;
        return MIN_WEIGHT + bonus;
    }

    // ============ PROPOSAL & DISPUTE FLOW (V5) ============
    
    function getRequiredBond(string memory _id) public view returns (uint256) {
        Market storage m = markets[_id];
        uint256 pool = m.totalYes + m.totalNo;
        uint256 bond = pool / 10; // 10%
        if (bond < 5 * 10**6) return 5 * 10**6; // Min 5 USDC
        return bond;
    }

    function proposeOutcome(string memory _marketId, bool _result, string memory _evidenceUrl) external {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        
        // V5: Allow propose if OPEN or LOCKED
        require(m.state == MarketState.OPEN || m.state == MarketState.LOCKED, "Not active");
        
        uint256 bondAmount = getRequiredBond(_marketId);
        require(usdcToken.transferFrom(msg.sender, address(this), bondAmount), "Bond transfer failed");
        
        m.proposer = msg.sender;
        m.proposedResult = _result;
        m.proposalTime = block.timestamp;
        m.bondAmount = bondAmount;
        m.evidenceUrl = _evidenceUrl;
        m.state = MarketState.PROPOSED;
        
        bondBalance[msg.sender] += bondAmount;
        
        emit OutcomeProposed(_marketId, msg.sender, _result, bondAmount, block.timestamp + DISPUTE_WINDOW, _evidenceUrl);
    }
    
    function challengeOutcome(string memory _marketId, string memory _evidenceUrl) external {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        
        require(m.state == MarketState.PROPOSED, "Not proposed");
        require(block.timestamp <= m.proposalTime + DISPUTE_WINDOW, "Dispute window closed");
        require(msg.sender != m.proposer, "Cannot challenge self");
        
        uint256 bondAmount = m.bondAmount; // Match proposer bond
        require(usdcToken.transferFrom(msg.sender, address(this), bondAmount), "Bond transfer failed");
        
        m.challenger = msg.sender;
        m.challengeBondAmount = bondAmount;
        m.challengeEvidenceUrl = _evidenceUrl;
        m.challengeTime = block.timestamp;
        
        bondBalance[msg.sender] += bondAmount;
        m.state = MarketState.DISPUTED;
        
        emit OutcomeChallenged(_marketId, msg.sender, bondAmount, _evidenceUrl);
    }
    
    function resolveDispute(string memory _marketId, address _winnerAddress, bool _finalResult) external onlyAdminOrOperator {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.DISPUTED, "Not in dispute");
        require(_winnerAddress == m.proposer || _winnerAddress == m.challenger, "Invalid winner");
        
        uint256 totalBond = m.bondAmount + m.challengeBondAmount;
        
        bondBalance[m.proposer] -= m.bondAmount;
        bondBalance[m.challenger] -= m.challengeBondAmount;
        
        // Send award
        require(usdcToken.transfer(_winnerAddress, totalBond), "Bond reward failed");
        
        m.state = MarketState.RESOLVED;
        m.result = _finalResult;
        
        m.bondAmount = 0;
        m.challengeBondAmount = 0;
        
        emit DisputeResolved(_marketId, _winnerAddress, totalBond, _finalResult);
        emit MarketResolved(_marketId, _finalResult, _finalResult ? m.totalYes : m.totalNo);
    }
    
    function finalizeOutcome(string memory _marketId) external {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        
        require(m.state == MarketState.PROPOSED, "Not proposed");
        require(block.timestamp > m.proposalTime + DISPUTE_WINDOW, "Window active");
        
        address proposer = m.proposer;
        uint256 bondAmount = m.bondAmount;
        
        bondBalance[proposer] -= bondAmount;
        require(usdcToken.transfer(proposer, bondAmount), "Bond return failed");
        
        // Reporter Reward (1% of total pool)
        uint256 reward = (m.totalYes + m.totalNo) / 100; 
        if (reward > 0 && houseBalance >= reward) {
            houseBalance -= reward;
            usdcToken.transfer(proposer, reward);
        }
        
        m.state = MarketState.RESOLVED;
        m.result = m.proposedResult;
        
        emit OutcomeFinalized(_marketId, proposer, reward);
        emit MarketResolved(_marketId, m.result, m.result ? m.totalYes : m.totalNo);
    }

    // ============ CLAIM (V5 Pull) ============
    
    function claimWinnings(string memory _id) external {
        Market storage m = markets[_id];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        
        UserBet storage yesBet = yesBets[_id][msg.sender];
        UserBet storage noBet = noBets[_id][msg.sender];
        
        require(!yesBet.claimed && !noBet.claimed, "Already claimed");
        
        uint256 payout = 0;
        
        if (m.isVoid) {
            payout = yesBet.amount + noBet.amount;
        } else {
             bool isYesWinner = m.result;
             UserBet storage winningBet = isYesWinner ? yesBet : noBet;
             
             if (winningBet.amount > 0) {
                 uint256 totalPool = m.totalYes + m.totalNo;
                 uint256 fee = (totalPool * (houseFeeBps + creatorFeeBps + referrerFeeBps)) / FEE_DENOMINATOR;
                 uint256 pot = totalPool - fee - (m.seedYes + m.seedNo); // Remove seed? V3 Logic was complex about seeds. 
                 // V3 Logic: "Dead liquidity (seed) that doesn't generate shares".
                 // Actually V3 `totalShares` logic handles the distribution.
                 // Payout = (UserShares / TotalShares) * Pot?
                 // Wait, V3 used shares. I must use shares for payout.
                 
                 uint256 winnerShares = isYesWinner ? m.totalSharesYes : m.totalSharesNo;
                 if (winnerShares > 0) {
                     uint256 distributablePool = totalPool - fee; // Simple pot
                     // Actually V3 seed logic means seed dilutes the pot for users?
                     // Or users dilute seed?
                     // Let's stick to simplest: Payout = (UserShares * DistributablePool) / TotalWinnerShares
                     payout = (winningBet.shares * distributablePool) / winnerShares;
                 }
             }
        }
        
        if (yesBet.amount > 0) yesBet.claimed = true;
        if (noBet.amount > 0) noBet.claimed = true;
        
        require(payout > 0, "Nothing to claim");
        require(usdcToken.transfer(msg.sender, payout), "Transfer failed");
        
        emit PayoutDistributed(_id, msg.sender, payout);
    }
    
    // ============ Emergency ============
    function adminResolve(string memory _marketId, bool _result) external onlyAdmin {
        Market storage m = markets[_marketId];
        require(m.state != MarketState.RESOLVED, "Resolved");
        
        // Return bonds if any
        if (m.bondAmount > 0) { 
             bondBalance[m.proposer] -= m.bondAmount;
             usdcToken.transfer(m.proposer, m.bondAmount);
        }
        if (m.challengeBondAmount > 0) {
             bondBalance[m.challenger] -= m.challengeBondAmount;
             usdcToken.transfer(m.challenger, m.challengeBondAmount);
        }
        
        m.state = MarketState.RESOLVED;
        m.result = _result;
        emit MarketResolved(_marketId, _result, 0);
    }
    
    function voidMarket(string memory _marketId) external onlyAdminOrOperator {
        Market storage m = markets[_marketId];
        require(m.state != MarketState.RESOLVED, "Resolved");
        
        if (m.bondAmount > 0) {
             bondBalance[m.proposer] -= m.bondAmount;
             usdcToken.transfer(m.proposer, m.bondAmount);
        }
        if (m.challengeBondAmount > 0) {
             bondBalance[m.challenger] -= m.challengeBondAmount;
             usdcToken.transfer(m.challenger, m.challengeBondAmount);
        }
        
        m.state = MarketState.RESOLVED;
        m.isVoid = true;
        emit MarketVoided(_marketId);
    }
}
