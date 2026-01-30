// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionBattle
 * @dev A simple prediction market contract for Farcaster frames.
 * Admin creates markets. Users bet ETH/Native Token on YES/NO.
 * Admin resolves markets. Winners claim their share.
 */
contract PredictionBattle {
    address public admin;
    uint256 public creatorFeeBps = 500; // 5% fee for market creator
    uint256 public platformFeeBps = 1000; // 10% platform fee

    struct Prediction {
        string id;
        address creator; // Market Creator
        uint256 target;
        uint256 deadline;
        bool resolved;
        bool result; // true = YES, false = NO
        uint256 totalYes;
        uint256 totalNo;
        
        // Dead Liquidity Tracking (Seed)
        uint256 seedYes;
        uint256 seedNo;

        // Tracking bettors for auto-distribution
        address[] yesBettors;
        address[] noBettors;
        mapping(address => uint256) yesBets;
        mapping(address => uint256) noBets;
        // Payout tracking
        bool isVoid; // New: Refund/Draw flag
        uint256 processedIndex; // To track how many winners have been paid (for batching)
        bool paidOut;
    }

    mapping(string => Prediction) public predictions;
    mapping(string => bool) public predictionExists;

    mapping(address => bool) public operators; // Authorized auto-verifiers

    event PredictionCreated(string id, address creator, uint256 target, uint256 deadline);
    event SeedAdded(string id, uint256 seedYes, uint256 seedNo);
    event BetPlaced(string id, address user, bool vote, uint256 amount);
    event PredictionResolved(string id, bool result, uint256 winnerPool, uint256 platformFee, uint256 creatorFee);
    event PredictionVoided(string id, uint256 totalPool, uint256 platformFee);
    event PayoutDistributed(string id, address user, uint256 amount);
    event DistributionCompleted(string id);
    event OperatorUpdated(address operator, bool status);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyAdminOrOperator() {
        require(msg.sender == admin || operators[msg.sender], "Not authorized");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // 0. Manage Operators
    function setOperator(address _operator, bool _status) external onlyAdmin {
        operators[_operator] = _status;
        emit OperatorUpdated(_operator, _status);
    }

    // 1. Create a Prediction Market (Permissionless + Seed in one Tx)
    function createPrediction(string memory _id, uint256 _target, uint256 _duration) external payable {
        require(!predictionExists[_id], "Prediction ID already exists");
        require(msg.value > 0 && msg.value % 2 == 0, "Seed must be > 0 and even");
        
        Prediction storage p = predictions[_id];
        p.id = _id;
        p.creator = msg.sender;
        p.target = _target;
        p.deadline = block.timestamp + _duration;
        p.resolved = false;
        p.isVoid = false;
        p.processedIndex = 0;
        p.paidOut = false;
        
        // Auto-Seed Split (Dead Liquidity)
        uint256 seedPerSide = msg.value / 2;
        p.totalYes = seedPerSide;
        p.totalNo = seedPerSide;
        p.seedYes = seedPerSide;
        p.seedNo = seedPerSide;
        
        predictionExists[_id] = true;
        
        emit PredictionCreated(_id, msg.sender, _target, p.deadline);
        emit SeedAdded(_id, seedPerSide, seedPerSide);
    }

    // 1.5 Additional Seed (Optional Boost)
    function seedPrediction(string memory _id) external payable { // Simplified signature
        require(predictionExists[_id], "Prediction does not exist");
        require(msg.value > 0 && msg.value % 2 == 0, "Seed must be > 0 and even");
        
        uint256 seedPerSide = msg.value / 2;

        Prediction storage p = predictions[_id];
        
        p.totalYes += seedPerSide;
        p.totalNo += seedPerSide;
        p.seedYes += seedPerSide;
        p.seedNo += seedPerSide;
        
        emit SeedAdded(_id, seedPerSide, seedPerSide);
    }

    // 2. Place a Bet
    function placeBet(string memory _id, bool _vote) external payable {
        require(predictionExists[_id], "Prediction does not exist");
        Prediction storage p = predictions[_id];
        require(block.timestamp < p.deadline, "Betting period expired");
        require(msg.value > 0, "Bet amount must be greater than 0");

        if (_vote) {
            if (p.yesBets[msg.sender] == 0) {
                p.yesBettors.push(msg.sender);
            }
            p.yesBets[msg.sender] += msg.value;
            p.totalYes += msg.value;
        } else {
            if (p.noBets[msg.sender] == 0) {
                p.noBettors.push(msg.sender);
            }
            p.noBets[msg.sender] += msg.value;
            p.totalNo += msg.value;
        }

        emit BetPlaced(_id, msg.sender, _vote, msg.value);
    }

    // 3. Resolve Prediction
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
        
        // Send Platform Fee
        (bool sentHouse, ) = admin.call{value: platformFee}("");
        require(sentHouse, "Failed to send platform fee");

        // Send Creator Fee (if creator exists and isn't admin/null)
        if (p.creator != address(0) && p.creator != admin) {
             (bool sentCreator, ) = p.creator.call{value: creatorFee}("");
             require(sentCreator, "Failed to send creator fee");
        } else {
            // If self-created by admin, keep fee or burn? Keep in contract or treat as revenue?
            // Sending to admin for simplicity
            (bool sentAdmin, ) = admin.call{value: creatorFee}("");
            require(sentAdmin, "Failed to send creator fee to admin");
        }
        
        // Distributable = Total - 25% (20+5)
        uint256 totalFees = platformFee + creatorFee;

        emit PredictionResolved(_id, _result, totalPool - totalFees, platformFee, creatorFee);
    }

    // 3.5. Resolve as Void (Draw/Refund)
    function resolveVoid(string memory _id) external onlyAdmin {
        require(predictionExists[_id], "Prediction does not exist");
        Prediction storage p = predictions[_id];
        require(!p.resolved, "Already resolved");

        p.resolved = true;
        p.isVoid = true; // Mark as void

        uint256 totalPool = p.totalYes + p.totalNo;
        uint256 fee = (totalPool * platformFeeBps) / 10000;
        // No creator fee on void? Or yes? Usually void returns 100% or keeps fees.
        // Standard: Users prefer 100% refund. But to prevent spam, maybe fees kept?
        // Current implementation: Keeps platform fee, refunds rest.
        
        (bool sent, ) = admin.call{value: fee}("");
        require(sent, "Failed to send platform fee");

        emit PredictionVoided(_id, totalPool - fee, fee);
    }

    // 4. Distribute Winnings (Batch Processing)
    function distributeWinnings(string memory _id, uint256 _batchSize) external onlyAdminOrOperator {
        Prediction storage p = predictions[_id];
        require(p.resolved, "Prediction not resolved yet");
        require(!p.paidOut, "Already fully paid out");

        address[] memory winners; // Users who have SHARES
        
        uint256 totalPool = p.totalYes + p.totalNo;
        uint256 platformFee = (totalPool * platformFeeBps) / 10000;
        uint256 creatorFee = (totalPool * creatorFeeBps) / 10000;
        uint256 distributablePot = totalPool - platformFee - creatorFee;

        if (p.isVoid) {
            // VOID LOGIC (Refunding Everyone)
            // Distribute Pot is effectively Total - Fees.
            // ... (Same Void Logic as before, just treating refund proportional to bet)
            
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
                     // Void Refund: Proportional to what's left after fee logic
                     // Or 100% if we didn't take fees (currently we took platform fee).
                     // If seed existed, seed is also lost (or refunded to whom? Creator?).
                     // Current Logic: Only 'Bettors' in the list get refunded.
                     // Seed amount is basically 'donated' to the void refund pool if creator isn't in list.
                     // This is acceptable for Dead Liquidity.
                     
                     uint256 totalUserBets = totalPool - p.seedYes - p.seedNo; // Total Claimable
                     if (totalUserBets > 0) {
                        uint256 refund = (betAmount * distributablePot) / totalUserBets;
                        (bool sent, ) = userAddr.call{value: refund}("");
                        require(sent, "Transfer failed"); 
                        emit PayoutDistributed(_id, userAddr, refund);
                     }
                 }
             }
            
             p.processedIndex = endIndex;
             if (p.processedIndex >= totalBettors) {
                 p.paidOut = true;
                 emit DistributionCompleted(_id);
             }
             return;
        }

        // --- WINNER LOGIC ---
        
        uint256 winningPoolTotal; // Including Seed
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
        
        // Critical Fix for Dead Liquidity:
        // The shares that are eligible for payout = Total - Seed.
        uint256 eligibleShares = winningPoolTotal - winningSeed;

        if (winners.length == 0 || eligibleShares == 0) {
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
                // Denominator is now ONLY eligible shares (excluding seed)
                // This means the Seed's portion of the win is distributed to these users.
                uint256 payout = (betAmount * distributablePot) / eligibleShares;
                
                (bool sent, ) = winnerAddr.call{value: payout}("");
                require(sent, "Transfer failed");
                emit PayoutDistributed(_id, winnerAddr, payout);
            }
        }

        p.processedIndex = endNormalIndex;

        if (p.processedIndex >= totalWinners) {
            p.paidOut = true;
            emit DistributionCompleted(_id);
        }
    }
}

