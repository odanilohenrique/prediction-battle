// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionBattleUSDC
 * @dev A prediction market contract using USDC (ERC20) for betting.
 * Admin creates markets. Users bet USDC on YES/NO.
 * Admin resolves markets. Winners receive USDC payouts.
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PredictionBattleUSDC {
    address public admin;
    IERC20 public usdcToken;
    uint256 public platformFeeBps = 2000; // 20% fee
    uint256 public creatorFeeBps = 500;   // 5% fee for creator

    struct Prediction {
        string id;
        uint256 target;
        uint256 deadline;
        bool resolved;
        bool result; // true = YES, false = NO
        uint256 totalYes;
        uint256 totalNo;
        // Tracking bettors for auto-distribution
        address[] yesBettors;
        address[] noBettors;
        mapping(address => uint256) yesBets;
        mapping(address => uint256) noBets;
        // Payout tracking
        bool isVoid;
        uint256 processedIndex;
        bool paidOut;
        address creator; // Market creator for 5% fee
        uint256 seedYes;
        uint256 seedNo;
    }

    mapping(string => Prediction) public predictions;
    mapping(string => bool) public predictionExists;
    mapping(address => bool) public operators; // Authorized auto-verifiers

    event PredictionCreated(string id, uint256 target, uint256 deadline, address creator);
    event BetPlaced(string id, address user, bool vote, uint256 amount);
    event PredictionResolved(string id, bool result, uint256 winnerPool, uint256 totalFees);
    event PredictionVoided(string id, uint256 totalPool, uint256 platformFee);
    event PayoutDistributed(string id, address user, uint256 amount);
    event DistributionCompleted(string id);
    event OperatorUpdated(address operator, bool status);
    event SeedAdded(string id, uint256 yesAmount, uint256 noAmount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
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

    // 0. Manage Operators
    function setOperator(address _operator, bool _status) external onlyAdmin {
        operators[_operator] = _status;
        emit OperatorUpdated(_operator, _status);
    }

    // Transfer admin rights to another address
    function setAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid address");
        admin = _newAdmin;
    }

    // 1. Create a Prediction Market (Create + Seed Atomically)
    function createPrediction(string memory _id, uint256 _target, uint256 _duration, uint256 _seedAmount) external {
        require(!predictionExists[_id], "Prediction ID already exists");
        require(_seedAmount > 0 && _seedAmount % 2 == 0, "Seed must be > 0 and even");
        
        // Transfer USDC from creator to contract
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
        
        // Auto-Seed
        uint256 seedPerSide = _seedAmount / 2;
        p.totalYes = seedPerSide;
        p.totalNo = seedPerSide;
        p.seedYes = seedPerSide;
        p.seedNo = seedPerSide;
        
        predictionExists[_id] = true;
        
        emit PredictionCreated(_id, _target, p.deadline, msg.sender);
        emit SeedAdded(_id, seedPerSide, seedPerSide);
    }

    // 1.5 Seed Liquidity (Dead Liquidity) - USDC
    // Creator MUST approve USDC transfer before calling this
    function seedPrediction(string memory _id, uint256 _seedAmount) external {
        require(predictionExists[_id], "Prediction does not exist");
        require(_seedAmount > 0 && _seedAmount % 2 == 0, "Seed must be > 0 and even");
        
        Prediction storage p = predictions[_id];
        
        // Transfer USDC from creator to contract
        require(usdcToken.transferFrom(msg.sender, address(this), _seedAmount), "USDC transfer failed");
        
        uint256 seedPerSide = _seedAmount / 2;
        
        p.totalYes += seedPerSide;
        p.totalNo += seedPerSide;
        p.seedYes += seedPerSide;
        p.seedNo += seedPerSide;
        
        emit SeedAdded(_id, seedPerSide, seedPerSide);
    }

    // 2. Place a Bet (User must `approve` USDC first)
    function placeBet(string memory _id, bool _vote, uint256 _amount) external {
        require(predictionExists[_id], "Prediction does not exist");
        Prediction storage p = predictions[_id];
        require(block.timestamp < p.deadline, "Betting period expired");
        require(_amount > 0, "Bet amount must be greater than 0");

        // Transfer USDC from user to contract
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

        emit BetPlaced(_id, msg.sender, _vote, _amount);
    }

    // 3. Resolve Prediction (Standard Logic)
    function resolvePrediction(string memory _id, bool _result) external onlyAdminOrOperator {
        require(predictionExists[_id], "Prediction does not exist");
        Prediction storage p = predictions[_id];
        require(!p.resolved, "Already resolved");
        
        p.resolved = true;
        p.result = _result;

        // Calculate Fees
        uint256 totalPool = p.totalYes + p.totalNo;
        uint256 platformFee = (totalPool * platformFeeBps) / 10000;
        uint256 creatorFee = (totalPool * creatorFeeBps) / 10000;
        
        // Send fees
        require(usdcToken.transfer(admin, platformFee), "Failed to send platform fee");
        if (p.creator != address(0)) {
            require(usdcToken.transfer(p.creator, creatorFee), "Failed to send creator fee");
        } else {
            require(usdcToken.transfer(admin, creatorFee), "Legacy creator fee to admin");
        }

        uint256 totalFees = platformFee + creatorFee;
        emit PredictionResolved(_id, _result, totalPool - totalFees, totalFees);
    }

    // 3.5. Resolve as Void (Draw/Refund)
    function resolveVoid(string memory _id) external onlyAdminOrOperator {
        require(predictionExists[_id], "Prediction does not exist");
        Prediction storage p = predictions[_id];
        require(!p.resolved, "Already resolved");

        p.resolved = true;
        p.isVoid = true;

        uint256 totalPool = p.totalYes + p.totalNo;
        uint256 fee = (totalPool * platformFeeBps) / 10000;

        // Send fee to admin
        require(usdcToken.transfer(admin, fee), "Failed to send platform fee");

        emit PredictionVoided(_id, totalPool - fee, fee);
    }

    // 4. Distribute Winnings (Batch Processing)
    function distributeWinnings(string memory _id, uint256 _batchSize) external onlyAdminOrOperator {
        Prediction storage p = predictions[_id];
        require(p.resolved, "Prediction not resolved yet");
        require(!p.paidOut, "Already fully paid out");

        address[] memory winners;
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

        // --- NORMAL LOGIC (Win/Loss) with DEAD LIQUIDITY ---
        uint256 winningPoolTotal;
        uint256 winningSeed;
        
        if (p.result) { // YES won
            winners = p.yesBettors;
            winningPoolTotal = p.totalYes;
            winningSeed = p.seedYes;
        } else { // NO won
            winners = p.noBettors;
            winningPoolTotal = p.totalNo;
            winningSeed = p.seedNo;
        }

        if (winners.length == 0) {
            p.paidOut = true;
            return;
        }

        // Determine Eligible Shares
        // CRITICAL FIX: To implement Dead Liquidity correctly, the user's share is calculated against
        // the TOTAL winning pool (including seed). This ensures that if a user bets small against a large seed,
        // they don't take the entire pot, but only their proportional share.
        // The "share" of the Seed stays in the contract (surplus).
        uint256 eligibleShares = winningPoolTotal; 
        
        // If simply nobody bet and nobody seeded (impossible due to creation logic), return.
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
                /** 
                 * DEAD LIQUIDITY FORMULA:
                 * Payout = (UserBet / (TotalWinningBets + winningSeed)) * DistributablePot
                 */
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

    // Admin function to withdraw dead liquidity / surplus from the contract
    function withdrawSurplus(uint256 _amount) external onlyAdmin {
        require(usdcToken.transfer(admin, _amount), "Withdraw failed");
    }
}
