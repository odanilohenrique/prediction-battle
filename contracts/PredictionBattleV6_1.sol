// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionBattleV6_1
 * @dev V6.1: Governance Features + Treasury + Pull Payments for Bonds
 *      - Governance:setAdmin, setTreasury
 *      - Treasury: withdrawHouseFees -> Treasury Wallet
 *      - Dispute: Correct 1% Reward Payout
 *      - Bonds: Pull Payment Pattern (withdrawBond)
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PredictionBattleV6_1 {
    address public admin;
    address public treasury; // [NEW] Treasury Address
    IERC20 public usdcToken;
    
    // Config
    uint256 public constant DISPUTE_WINDOW = 43200; // 12 Hours
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Fee Config
    uint256 public houseFeeBps = 1000;   // 10%
    uint256 public creatorFeeBps = 500;  // 5%
    uint256 public referrerFeeBps = 500; // 5%
    
    // Shares Config
    uint256 public constant SHARE_PRECISION = 1e18;
    uint256 public constant MAX_WEIGHT = 150; // 1.5x
    uint256 public constant MIN_WEIGHT = 100; // 1.0x
    
    // Balances
    uint256 public houseBalance;
    mapping(address => uint256) public creatorBalance;
    mapping(address => uint256) public rewardsBalance; // Referrer rewards
    
    // [NEW] Claimable Bonds (Pull Payment for Proposers/Challengers)
    mapping(address => uint256) public claimableBonds;

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
    
    mapping(string => mapping(address => UserBet)) public yesBets;
    mapping(string => mapping(address => UserBet)) public noBets;

    mapping(string => mapping(address => bool)) public hasClaimed;
    
    // Locked bonds (balance tracking mainly for view, NOT for claim)
    mapping(address => uint256) public bondBalance;
    
    event MarketCreated(string id, address creator, uint256 deadline, uint256 bonusDuration);
    event BetPlaced(string id, address user, bool vote, uint256 amount, uint256 shares, address referrer, uint256 weight);
    event SeedAdded(string id, uint256 yesAmount, uint256 noAmount);
    
    event OutcomeProposed(string id, address proposer, bool result, uint256 bond, uint256 disputeEnd, string evidence);
    event OutcomeChallenged(string id, address challenger, uint256 bond, string evidence);
    event DisputeResolved(string id, address winner, uint256 totalBondReward, bool finalResult);
    event OutcomeFinalized(string id, address proposer, uint256 reward);
    event MarketResolved(string id, bool result, uint256 winnerPool);
    event MarketVoided(string id);
    event PayoutClaimed(string id, address user, uint256 amount);
    event SeedWithdrawn(string id, address creator, uint256 amount);
    
    // [NEW] Events
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event AdminUpdated(address oldAdmin, address newAdmin);
    event HouseFeeWithdrawn(address treasury, uint256 amount);
    event BondWithdrawn(address user, uint256 amount);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    // [NEW] Constructor with Initial Admin & Treasury
    constructor(address _usdcAddress, address _initialAdmin, address _treasury) {
        require(_initialAdmin != address(0), "Invalid Admin");
        require(_treasury != address(0), "Invalid Treasury");
        
        admin = _initialAdmin;
        treasury = _treasury;
        usdcToken = IERC20(_usdcAddress);
    }

    // ============ GOVERNANCE (NEW) ============

    function setAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid address");
        emit AdminUpdated(admin, _newAdmin);
        admin = _newAdmin;
    }

    function setTreasury(address _newTreasury) external onlyAdmin {
        require(_newTreasury != address(0), "Invalid address");
        emit TreasuryUpdated(treasury, _newTreasury);
        treasury = _newTreasury;
    }
    
    // ============ Core Functions (Unchanged Logic, just copy) ============
    
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
        
        // Fee Logic
        uint256 houseFee = (_usdcAmount * houseFeeBps) / FEE_DENOMINATOR;
        uint256 creatorFee = (_usdcAmount * creatorFeeBps) / FEE_DENOMINATOR;
        uint256 referrerFee = 0;
        
        if (_referrer != address(0) && _referrer != msg.sender) {
             referrerFee = (_usdcAmount * referrerFeeBps) / FEE_DENOMINATOR;
             rewardsBalance[_referrer] += referrerFee;
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

    // ============ PROPOSAL & DISPUTE FLOW (MODIFIED for REWARDS + PULL PAYMENT) ============
    
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
        
        require(m.state == MarketState.OPEN || m.state == MarketState.LOCKED, "Not active");
        
        uint256 bondAmount = getRequiredBond(_marketId);
        require(usdcToken.transferFrom(msg.sender, address(this), bondAmount), "Bond transfer failed");
        
        m.proposer = msg.sender;
        m.proposedResult = _result;
        m.proposalTime = block.timestamp;
        m.bondAmount = bondAmount;
        m.evidenceUrl = _evidenceUrl;
        m.state = MarketState.PROPOSED;
        
        bondBalance[msg.sender] += bondAmount; // Track locked bond
        
        emit OutcomeProposed(_marketId, msg.sender, _result, bondAmount, block.timestamp + DISPUTE_WINDOW, _evidenceUrl);
    }
    
    function challengeOutcome(string memory _marketId, string memory _evidenceUrl) external {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        
        require(m.state == MarketState.PROPOSED, "Not proposed");
        require(block.timestamp <= m.proposalTime + DISPUTE_WINDOW, "Dispute window closed");
        require(msg.sender != m.proposer, "Cannot challenge self");
        
        uint256 bondAmount = m.bondAmount; 
        require(usdcToken.transferFrom(msg.sender, address(this), bondAmount), "Bond transfer failed");
        
        m.challenger = msg.sender;
        m.challengeBondAmount = bondAmount;
        m.challengeEvidenceUrl = _evidenceUrl;
        m.challengeTime = block.timestamp;
        
        bondBalance[msg.sender] += bondAmount; // Track locked bond
        m.state = MarketState.DISPUTED;
        
        emit OutcomeChallenged(_marketId, msg.sender, bondAmount, _evidenceUrl);
    }
    
    // [FIX + PULL] Resolve Dispute with PULL Payment and Reward Calculation
    function resolveDispute(string memory _marketId, address _winnerAddress, bool _finalResult) external onlyAdmin {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.DISPUTED, "Not in dispute");
        require(_winnerAddress == m.proposer || _winnerAddress == m.challenger, "Invalid winner");
        
        uint256 totalBond = m.bondAmount + m.challengeBondAmount;
        
        // Remove from Locked Balance
        bondBalance[m.proposer] -= m.bondAmount;
        bondBalance[m.challenger] -= m.challengeBondAmount;
        
        // Calculate Reward (1% of Total Pool) [NEW FIX]
        uint256 reward = (m.totalYes + m.totalNo) / 100;
        if (reward > 0 && houseBalance >= reward) {
            houseBalance -= reward;
            totalBond += reward; // Add reward to payout
        }

        // [PULL PATTERN] Credit to Verified/Challenger Winner
        claimableBonds[_winnerAddress] += totalBond;
        
        m.state = MarketState.RESOLVED;
        m.result = _finalResult;
        
        m.bondAmount = 0;
        m.challengeBondAmount = 0;
        
        emit DisputeResolved(_marketId, _winnerAddress, totalBond, _finalResult);
        emit MarketResolved(_marketId, _finalResult, _finalResult ? m.totalYes : m.totalNo);
    }
    
    // [PULL PATTERN] Finalize Outcome
    function finalizeOutcome(string memory _marketId) external {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        
        require(m.state == MarketState.PROPOSED, "Not proposed");
        require(block.timestamp > m.proposalTime + DISPUTE_WINDOW, "Window active");
        
        address proposer = m.proposer;
        uint256 bondAmount = m.bondAmount;
        
        // Remove from locked balance
        bondBalance[proposer] -= bondAmount;
        
        // Reporter Reward (1% of total pool)
        uint256 reward = (m.totalYes + m.totalNo) / 100; 
        
        uint256 totalPayout = bondAmount;

        if (reward > 0 && houseBalance >= reward) {
            houseBalance -= reward;
            totalPayout += reward;
        }
        
        // [PULL PATTERN] Credit to Proposer
        claimableBonds[proposer] += totalPayout;
        
        m.state = MarketState.RESOLVED;
        m.result = m.proposedResult;
        
        emit OutcomeFinalized(_marketId, proposer, reward);
        emit MarketResolved(_marketId, m.result, m.result ? m.totalYes : m.totalNo);
    }
    
    // [NEW] Withdraw Bond (Pull Payment Function)
    function withdrawBond() external {
        uint256 amount = claimableBonds[msg.sender];
        require(amount > 0, "No bonds to claim");
        
        claimableBonds[msg.sender] = 0;
        
        require(usdcToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit BondWithdrawn(msg.sender, amount);
    }

    // ============ WINNINGS CLAIM (Legacy V6) ============
    
    function claimWinnings(string memory _id) external {
        require(marketExists[_id], "No market");
        Market storage m = markets[_id];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        
        require(!hasClaimed[_id][msg.sender], "Already claimed");
        
        uint256 payout = 0;
        UserBet storage yesBet = yesBets[_id][msg.sender];
        UserBet storage noBet = noBets[_id][msg.sender];
        
        if (m.isVoid) {
            payout = yesBet.amount + noBet.amount;
        } else {
             bool isYesWinner = m.result;
             UserBet storage winningBet = isYesWinner ? yesBet : noBet;
             
             if (winningBet.amount > 0 && winningBet.shares > 0) {
                 uint256 totalPool = m.totalYes + m.totalNo;
                 uint256 fee = (totalPool * (houseFeeBps + creatorFeeBps + referrerFeeBps)) / FEE_DENOMINATOR;
                 uint256 distributablePool = totalPool - fee; 
                 
                 uint256 totalWinningShares = isYesWinner ? m.totalSharesYes : m.totalSharesNo;
                 
                 if (totalWinningShares > 0) {
                     payout = (winningBet.shares * distributablePool) / totalWinningShares;
                 }
             }
        }
        
        require(payout > 0, "Nothing to claim");
        
        hasClaimed[_id][msg.sender] = true;
        if (yesBet.amount > 0) yesBet.claimed = true;
        if (noBet.amount > 0) noBet.claimed = true;
        
        require(usdcToken.transfer(msg.sender, payout), "Transfer failed");
        
        emit PayoutClaimed(_id, msg.sender, payout);
    }
    
    function withdrawSeed(string memory _id) external {
         require(marketExists[_id], "No market");
         Market storage m = markets[_id];
         require(m.state == MarketState.RESOLVED, "Not resolved");
         require(m.isVoid, "Market not void");
         require(msg.sender == m.creator, "Only creator");
         require(!hasClaimed[_id][msg.sender], "Already withdrawn");
         
         uint256 totalSeed = m.seedYes + m.seedNo;
         require(totalSeed > 0, "No seed");
         
         hasClaimed[_id][msg.sender] = true;
         
         require(usdcToken.transfer(msg.sender, totalSeed), "Transfer failed");
         emit SeedWithdrawn(_id, msg.sender, totalSeed);
    }
    
    // ============ FEE WITHDRAWALS ============

    function withdrawCreatorFees() external {
        uint256 amount = creatorBalance[msg.sender];
        require(amount > 0, "No fees");
        creatorBalance[msg.sender] = 0;
        require(usdcToken.transfer(msg.sender, amount), "Transfer failed");
    }

    function withdrawReferrerFees() external {
        uint256 amount = rewardsBalance[msg.sender];
        require(amount > 0, "No fees");
        rewardsBalance[msg.sender] = 0;
        require(usdcToken.transfer(msg.sender, amount), "Transfer failed");
    }
    
    // [NEW] Withdraw House Fees -> Treasury
    function withdrawHouseFees() external onlyAdmin {
        uint256 amount = houseBalance;
        require(amount > 0, "No fees");
        
        houseBalance = 0;
        
        require(usdcToken.transfer(treasury, amount), "Transfer failed");
        emit HouseFeeWithdrawn(treasury, amount);
    }
    
    // ============ Emergency / Admin ============
    
    function adminResolve(string memory _marketId, bool _result) external onlyAdmin {
        Market storage m = markets[_marketId];
        require(m.state != MarketState.RESOLVED, "Resolved");
        
        // Return bonds (Legacy Push for Admin Override - maybe safer to Pull but keeping as is for emergency clarity?
        // Actually, let's Stick to Pull Pattern for consistency if bond exists.
        
        if (m.bondAmount > 0) { 
             bondBalance[m.proposer] -= m.bondAmount;
             claimableBonds[m.proposer] += m.bondAmount; // Convert to pull
        }
        if (m.challengeBondAmount > 0) {
             bondBalance[m.challenger] -= m.challengeBondAmount;
             claimableBonds[m.challenger] += m.challengeBondAmount; // Convert to pull
        }
        
        m.state = MarketState.RESOLVED;
        m.result = _result;
        emit MarketResolved(_marketId, _result, 0);
    }
    
    function voidMarket(string memory _marketId) external onlyAdmin {
        Market storage m = markets[_marketId];
        require(m.state != MarketState.RESOLVED, "Resolved");
        
        if (m.bondAmount > 0) {
             bondBalance[m.proposer] -= m.bondAmount;
             claimableBonds[m.proposer] += m.bondAmount; // Convert to pull
        }
        if (m.challengeBondAmount > 0) {
             bondBalance[m.challenger] -= m.challengeBondAmount;
             claimableBonds[m.challenger] += m.challengeBondAmount; // Convert to pull
        }
        
        m.state = MarketState.RESOLVED;
        m.isVoid = true;
        emit MarketVoided(_marketId);
    }
}
