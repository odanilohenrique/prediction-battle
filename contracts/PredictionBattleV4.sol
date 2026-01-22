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
    uint256 public referralShareBps = 2500; // 25% of platform fee goes to referrals

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
        address[] referrers;
        mapping(address => uint256) totals;
        uint256 totalReferredAmount;
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
        require(_platformFeeBps <= 3000, "Platform fee too high");
        require(_creatorFeeBps <= 1000, "Creator fee too high");
        require(_referralShareBps <= 5000, "Referral share too high");
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

    function placeBet(string memory _id, bool _vote, uint256 _amount, address _referrer) external {
        require(predictionExists[_id], "Does not exist");
        Prediction storage p = predictions[_id];
        require(block.timestamp < p.deadline, "Betting closed");
        require(_amount > 0, "Amount must be > 0");

        require(usdcToken.transferFrom(msg.sender, address(this), _amount), "USDC transfer failed");

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
        uint256 platformFee = (totalPool * platformFeeBps) / 10000;
        uint256 creatorFee = (totalPool * creatorFeeBps) / 10000;
        uint256 referralPool = (platformFee * referralShareBps) / 10000;
        
        // Pay admin (platform fee minus referral pool)
        usdcToken.transfer(admin, platformFee - referralPool);
        
        // Pay referrers
        _distributeReferralFees(_id, referralPool);
        
        // Pay creator
        if (p.creator != address(0)) {
            usdcToken.transfer(p.creator, creatorFee);
        } else {
            usdcToken.transfer(admin, creatorFee);
        }

        emit PredictionResolved(_id, _result, totalPool - platformFee - creatorFee, platformFee + creatorFee);
    }

    function _distributeReferralFees(string memory _id, uint256 _referralPool) internal {
        ReferralInfo storage refInfo = referralInfo[_id];
        
        if (refInfo.totalReferredAmount == 0 || _referralPool == 0) {
            // No referrals, admin gets the referral pool too
            usdcToken.transfer(admin, _referralPool);
            return;
        }

        uint256 totalReferred = refInfo.totalReferredAmount;
        
        for (uint256 i = 0; i < refInfo.referrers.length; i++) {
            address ref = refInfo.referrers[i];
            uint256 refAmount = refInfo.totals[ref];
            uint256 refPayout = (refAmount * _referralPool) / totalReferred;
            
            if (refPayout > 0) {
                usdcToken.transfer(ref, refPayout);
                emit ReferralPaid(_id, ref, refPayout);
            }
        }
    }

    function resolveVoid(string memory _id) external onlyAdminOrOperator {
        require(predictionExists[_id], "Does not exist");
        Prediction storage p = predictions[_id];
        require(!p.resolved, "Already resolved");

        p.resolved = true;
        p.isVoid = true;

        uint256 totalPool = p.totalYes + p.totalNo;
        uint256 fee = (totalPool * platformFeeBps) / 10000;

        usdcToken.transfer(admin, fee);

        emit PredictionVoided(_id, totalPool - fee, fee);
    }

    // ============ Distribution ============

    function distributeWinnings(string memory _id, uint256 _batchSize) external onlyAdminOrOperator {
        Prediction storage p = predictions[_id];
        require(p.resolved, "Not resolved");
        require(!p.paidOut, "Already paid out");

        if (p.isVoid) {
            _distributeVoid(_id, _batchSize);
        } else {
            _distributeNormal(_id, _batchSize);
        }
    }

    function _distributeVoid(string memory _id, uint256 _batchSize) internal {
        Prediction storage p = predictions[_id];
        
        uint256 totalPool = p.totalYes + p.totalNo;
        uint256 platformFee = (totalPool * platformFeeBps) / 10000;
        uint256 distributablePot = totalPool - platformFee;
        
        uint256 totalBettors = p.yesBettors.length + p.noBettors.length;
        uint256 endIndex = p.processedIndex + _batchSize;
        if (endIndex > totalBettors) endIndex = totalBettors;

        for (uint256 i = p.processedIndex; i < endIndex; i++) {
            (address userAddr, uint256 betAmount) = _getBettorInfo(p, i);
            _clearBet(p, userAddr, i < p.yesBettors.length);

            if (betAmount > 0) {
                uint256 refund = (betAmount * distributablePot) / totalPool;
                usdcToken.transfer(userAddr, refund);
                emit PayoutDistributed(_id, userAddr, refund);
            }
        }
        
        p.processedIndex = endIndex;
        if (p.processedIndex >= totalBettors) {
            p.paidOut = true;
            emit DistributionCompleted(_id);
        }
    }

    function _distributeNormal(string memory _id, uint256 _batchSize) internal {
        Prediction storage p = predictions[_id];
        
        uint256 totalPool = p.totalYes + p.totalNo;
        uint256 platformFee = (totalPool * platformFeeBps) / 10000;
        uint256 creatorFee = (totalPool * creatorFeeBps) / 10000;
        uint256 distributablePot = totalPool - platformFee - creatorFee;
        
        bool isYesWinner = p.result;
        uint256 winningPool = isYesWinner ? p.totalYes : p.totalNo;
        address[] storage winners = isYesWinner ? p.yesBettors : p.noBettors;

        if (winners.length == 0 || winningPool == 0) {
            p.paidOut = true;
            return;
        }

        uint256 endIndex = p.processedIndex + _batchSize;
        if (endIndex > winners.length) endIndex = winners.length;

        for (uint256 i = p.processedIndex; i < endIndex; i++) {
            address winnerAddr = winners[i];
            uint256 betAmount = isYesWinner ? p.yesBets[winnerAddr] : p.noBets[winnerAddr];
            
            if (isYesWinner) {
                p.yesBets[winnerAddr] = 0;
            } else {
                p.noBets[winnerAddr] = 0;
            }

            if (betAmount > 0) {
                uint256 payout = (betAmount * distributablePot) / winningPool;
                usdcToken.transfer(winnerAddr, payout);
                emit PayoutDistributed(_id, winnerAddr, payout);
            }
        }

        p.processedIndex = endIndex;
        if (p.processedIndex >= winners.length) {
            p.paidOut = true;
            emit DistributionCompleted(_id);
        }
    }

    function _getBettorInfo(Prediction storage p, uint256 index) internal view returns (address, uint256) {
        if (index < p.yesBettors.length) {
            address user = p.yesBettors[index];
            return (user, p.yesBets[user]);
        } else {
            address user = p.noBettors[index - p.yesBettors.length];
            return (user, p.noBets[user]);
        }
    }

    function _clearBet(Prediction storage p, address user, bool isYes) internal {
        if (isYes) {
            p.yesBets[user] = 0;
        } else {
            p.noBets[user] = 0;
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
        usdcToken.transfer(admin, _amount);
    }
}
