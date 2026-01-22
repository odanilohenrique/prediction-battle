// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionBattleV4
 * @dev Prediction market with USDC betting and on-chain referral system.
 * 
 * Fee Structure:
 * - Platform Fee: 20% of total pool
 *   - 75% goes to admin (15% of total)
 *   - 25% goes to referral pool (5% of total)
 * - Creator Fee: 5% of total pool
 * 
 * Referral Distribution:
 * - Proportional to bet amounts of referrals
 * - If no referrals, full platform fee goes to admin
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PredictionBattleV4 {
    address public admin;
    IERC20 public usdcToken;
    
    // Fee configuration (in basis points, 10000 = 100%)
    uint256 public platformFeeBps = 2000;   // 20% platform fee
    uint256 public creatorFeeBps = 500;     // 5% creator fee
    uint256 public referralShareBps = 2500; // 25% of platform fee goes to referrals (= 5% of total)

    struct Prediction {
        string id;
        uint256 target;
        uint256 deadline;
        bool resolved;
        bool result;
        uint256 totalYes;
        uint256 totalNo;
        address[] yesBettors;
        address[] noBettors;
        mapping(address => uint256) yesBets;
        mapping(address => uint256) noBets;
        bool isVoid;
        uint256 processedIndex;
        bool paidOut;
        address creator;
        uint256 seedYes;
        uint256 seedNo;
    }

    // Referral tracking per prediction
    struct ReferralInfo {
        address[] referrers;                    // List of unique referrers
        mapping(address => uint256) totals;     // referrer => total amount referred
        uint256 totalReferredAmount;            // Sum of all referred bets
    }

    mapping(string => Prediction) public predictions;
    mapping(string => bool) public predictionExists;
    mapping(string => ReferralInfo) private referralInfo;
    mapping(address => bool) public operators;

    event PredictionCreated(string id, uint256 target, uint256 deadline, address creator);
    event BetPlaced(string id, address user, bool vote, uint256 amount, address referrer);
    event PredictionResolved(string id, bool result, uint256 winnerPool, uint256 totalFees);
    event PredictionVoided(string id, uint256 totalPool, uint256 platformFee);
    event PayoutDistributed(string id, address user, uint256 amount);
    event ReferralPaid(string id, address referrer, uint256 amount);
    event DistributionCompleted(string id);
    event OperatorUpdated(address operator, bool status);
    event SeedAdded(string id, uint256 yesAmount, uint256 noAmount);

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
        emit OperatorUpdated(_operator, _status);
    }

    function setAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid address");
        admin = _newAdmin;
    }

    function setFees(uint256 _platformFeeBps, uint256 _creatorFeeBps, uint256 _referralShareBps) external onlyAdmin {
        require(_platformFeeBps <= 3000, "Platform fee too high"); // Max 30%
        require(_creatorFeeBps <= 1000, "Creator fee too high");   // Max 10%
        require(_referralShareBps <= 5000, "Referral share too high"); // Max 50% of platform fee
        platformFeeBps = _platformFeeBps;
        creatorFeeBps = _creatorFeeBps;
        referralShareBps = _referralShareBps;
    }

    // ============ Market Creation ============

    function createPrediction(string memory _id, uint256 _target, uint256 _duration, uint256 _seedAmount) external {
        require(!predictionExists[_id], "ID exists");
        require(_seedAmount > 0 && _seedAmount % 2 == 0, "Seed must be > 0 and even");
        
        require(usdcToken.transferFrom(msg.sender, address(this), _seedAmount), "USDC transfer failed");

        Prediction storage p = predictions[_id];
        p.id = _id;
        p.target = _target;
        p.deadline = block.timestamp + _duration;
        p.resolved = false;
        p.isVoid = false;
        p.processedIndex = 0;
        p.paidOut = false;
        p.creator = msg.sender;
        
        uint256 seedPerSide = _seedAmount / 2;
        p.totalYes = seedPerSide;
        p.totalNo = seedPerSide;
        p.seedYes = seedPerSide;
        p.seedNo = seedPerSide;
        
        predictionExists[_id] = true;
        
        emit PredictionCreated(_id, _target, p.deadline, msg.sender);
        emit SeedAdded(_id, seedPerSide, seedPerSide);
    }

    function seedPrediction(string memory _id, uint256 _seedAmount) external {
        require(predictionExists[_id], "Does not exist");
        require(_seedAmount > 0 && _seedAmount % 2 == 0, "Seed must be > 0 and even");
        
        Prediction storage p = predictions[_id];
        require(usdcToken.transferFrom(msg.sender, address(this), _seedAmount), "USDC transfer failed");
        
        uint256 seedPerSide = _seedAmount / 2;
        p.totalYes += seedPerSide;
        p.totalNo += seedPerSide;
        p.seedYes += seedPerSide;
        p.seedNo += seedPerSide;
        
        emit SeedAdded(_id, seedPerSide, seedPerSide);
    }

    // ============ Betting ============

    /**
     * @notice Place a bet on a prediction
     * @param _id Prediction ID
     * @param _vote true = YES, false = NO
     * @param _amount Amount of USDC to bet
     * @param _referrer Address of the referrer (use address(0) if none)
     */
    function placeBet(string memory _id, bool _vote, uint256 _amount, address _referrer) external {
        require(predictionExists[_id], "Does not exist");
        Prediction storage p = predictions[_id];
        require(block.timestamp < p.deadline, "Betting closed");
        require(_amount > 0, "Amount must be > 0");

        require(usdcToken.transferFrom(msg.sender, address(this), _amount), "USDC transfer failed");

        // Track bet
        if (_vote) {
            if (p.yesBets[msg.sender] == 0) {
                p.yesBettors.push(msg.sender);
            }
            p.yesBets[msg.sender] += _amount;
            p.totalYes += _amount;
        } else {
            if (p.noBets[msg.sender] == 0) {
                p.noBettors.push(msg.sender);
            }
            p.noBets[msg.sender] += _amount;
            p.totalNo += _amount;
        }

        // Track referral (only if valid and not self-referral)
        if (_referrer != address(0) && _referrer != msg.sender) {
            ReferralInfo storage refInfo = referralInfo[_id];
            if (refInfo.totals[_referrer] == 0) {
                refInfo.referrers.push(_referrer);
            }
            refInfo.totals[_referrer] += _amount;
            refInfo.totalReferredAmount += _amount;
        }

        emit BetPlaced(_id, msg.sender, _vote, _amount, _referrer);
    }

    // ============ Resolution ============

    function resolvePrediction(string memory _id, bool _result) external onlyAdminOrOperator {
        require(predictionExists[_id], "Does not exist");
        Prediction storage p = predictions[_id];
        require(!p.resolved, "Already resolved");
        
        p.resolved = true;
        p.result = _result;

        uint256 totalPool = p.totalYes + p.totalNo;
        
        // Calculate fees
        uint256 platformFee = (totalPool * platformFeeBps) / 10000;
        uint256 creatorFee = (totalPool * creatorFeeBps) / 10000;
        
        // Split platform fee between admin and referrers
        uint256 referralPool = (platformFee * referralShareBps) / 10000;
        uint256 adminFee = platformFee - referralPool;
        
        // Pay admin
        require(usdcToken.transfer(admin, adminFee), "Admin fee failed");
        
        // Pay referrers proportionally
        ReferralInfo storage refInfo = referralInfo[_id];
        if (refInfo.totalReferredAmount > 0 && referralPool > 0) {
            for (uint256 i = 0; i < refInfo.referrers.length; i++) {
                address ref = refInfo.referrers[i];
                uint256 refAmount = refInfo.totals[ref];
                uint256 refPayout = (refAmount * referralPool) / refInfo.totalReferredAmount;
                if (refPayout > 0) {
                    require(usdcToken.transfer(ref, refPayout), "Referral fee failed");
                    emit ReferralPaid(_id, ref, refPayout);
                }
            }
        } else {
            // No referrals, admin gets full platform fee
            require(usdcToken.transfer(admin, referralPool), "Unclaimed referral to admin");
        }
        
        // Pay creator
        if (p.creator != address(0)) {
            require(usdcToken.transfer(p.creator, creatorFee), "Creator fee failed");
        } else {
            require(usdcToken.transfer(admin, creatorFee), "Legacy creator fee");
        }

        uint256 totalFees = platformFee + creatorFee;
        emit PredictionResolved(_id, _result, totalPool - totalFees, totalFees);
    }

    function resolveVoid(string memory _id) external onlyAdminOrOperator {
        require(predictionExists[_id], "Does not exist");
        Prediction storage p = predictions[_id];
        require(!p.resolved, "Already resolved");

        p.resolved = true;
        p.isVoid = true;

        uint256 totalPool = p.totalYes + p.totalNo;
        uint256 fee = (totalPool * platformFeeBps) / 10000;

        require(usdcToken.transfer(admin, fee), "Platform fee failed");

        emit PredictionVoided(_id, totalPool - fee, fee);
    }

    // ============ Distribution ============

    function distributeWinnings(string memory _id, uint256 _batchSize) external onlyAdminOrOperator {
        Prediction storage p = predictions[_id];
        require(p.resolved, "Not resolved");
        require(!p.paidOut, "Already paid out");

        uint256 totalPool = p.totalYes + p.totalNo;
        uint256 platformFee = (totalPool * platformFeeBps) / 10000;
        uint256 creatorFee = (totalPool * creatorFeeBps) / 10000;
        
        uint256 distributablePot;
        
        if (p.isVoid) {
            distributablePot = totalPool - platformFee;
        } else {
            distributablePot = totalPool - platformFee - creatorFee;
        }
        
        // --- VOID LOGIC ---
        if (p.isVoid) {
            uint256 totalYesCount = p.yesBettors.length;
            uint256 totalNoCount = p.noBettors.length;
            uint256 totalBettors = totalYesCount + totalNoCount;
            
            uint256 endIndex = p.processedIndex + _batchSize;
            if (endIndex > totalBettors) endIndex = totalBettors;

            for (uint256 i = p.processedIndex; i < endIndex; i++) {
                address userAddr;
                uint256 betAmount;
                
                if (i < totalYesCount) {
                    userAddr = p.yesBettors[i];
                    betAmount = p.yesBets[userAddr];
                    p.yesBets[userAddr] = 0; 
                } else {
                    uint256 noIndex = i - totalYesCount;
                    userAddr = p.noBettors[noIndex];
                    betAmount = p.noBets[userAddr];
                    p.noBets[userAddr] = 0;
                }

                if (betAmount > 0) {
                    uint256 refund = (betAmount * distributablePot) / totalPool;
                    require(usdcToken.transfer(userAddr, refund), "Transfer failed");
                    emit PayoutDistributed(_id, userAddr, refund);
                }
            }
            
            p.processedIndex = endIndex;
            if (p.processedIndex >= totalBettors) {
                p.paidOut = true;
                emit DistributionCompleted(_id);
            }
            return;
        }

        // --- NORMAL LOGIC ---
        address[] memory winners;
        uint256 winningPoolTotal;
        
        if (p.result) {
            winners = p.yesBettors;
            winningPoolTotal = p.totalYes;
        } else {
            winners = p.noBettors;
            winningPoolTotal = p.totalNo;
        }

        if (winners.length == 0) {
            p.paidOut = true;
            return;
        }

        uint256 eligibleShares = winningPoolTotal;
        
        if (eligibleShares == 0) {
            p.paidOut = true;
            return;
        }

        uint256 totalWinners = winners.length;
        uint256 endNormalIndex = p.processedIndex + _batchSize;
        if (endNormalIndex > totalWinners) endNormalIndex = totalWinners;

        for (uint256 i = p.processedIndex; i < endNormalIndex; i++) {
            address winnerAddr = winners[i];
            uint256 betAmount;
            
            if (p.result) {
                betAmount = p.yesBets[winnerAddr];
                p.yesBets[winnerAddr] = 0; 
            } else {
                betAmount = p.noBets[winnerAddr];
                p.noBets[winnerAddr] = 0;
            }

            if (betAmount > 0) {
                uint256 payout = (betAmount * distributablePot) / eligibleShares;
                require(usdcToken.transfer(winnerAddr, payout), "Transfer failed");
                emit PayoutDistributed(_id, winnerAddr, payout);
            }
        }

        p.processedIndex = endNormalIndex;

        if (p.processedIndex >= totalWinners) {
            p.paidOut = true;
            emit DistributionCompleted(_id);
        }
    }

    // ============ View Functions ============

    function getReferralInfo(string memory _id, address _referrer) external view returns (uint256 referredAmount, uint256 totalReferred) {
        ReferralInfo storage refInfo = referralInfo[_id];
        return (refInfo.totals[_referrer], refInfo.totalReferredAmount);
    }

    function getReferrerCount(string memory _id) external view returns (uint256) {
        return referralInfo[_id].referrers.length;
    }

    function withdrawSurplus(uint256 _amount) external onlyAdmin {
        require(usdcToken.transfer(admin, _amount), "Withdraw failed");
    }
}
