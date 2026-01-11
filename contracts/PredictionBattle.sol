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
    uint256 public platformFeeBps = 2000; // 20% fee (2000 basis points)

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
        bool isVoid; // New: Refund/Draw flag
        uint256 processedIndex; // To track how many winners have been paid (for batching)
        bool paidOut;
    }

    mapping(string => Prediction) public predictions;
    mapping(string => bool) public predictionExists;

    mapping(address => bool) public operators; // Authorized auto-verifiers

    event PredictionCreated(string id, uint256 target, uint256 deadline);
    event BetPlaced(string id, address user, bool vote, uint256 amount);
    event PredictionResolved(string id, bool result, uint256 winnerPool, uint256 platformFee);
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

    // 1. Create a Prediction Market
    function createPrediction(string memory _id, uint256 _target, uint256 _duration) external onlyAdmin {
        require(!predictionExists[_id], "Prediction ID already exists");
        
        Prediction storage p = predictions[_id];
        p.id = _id;
        p.target = _target;
        p.deadline = block.timestamp + _duration;
        p.resolved = false;
        p.isVoid = false;
        p.processedIndex = 0;
        p.paidOut = false;
        
        predictionExists[_id] = true;
        
        emit PredictionCreated(_id, _target, p.deadline);
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

        // Calculate Fee
        uint256 totalPool = p.totalYes + p.totalNo;
        uint256 fee = (totalPool * platformFeeBps) / 10000;
        
        // Send fee to admin immediately
        (bool sent, ) = admin.call{value: fee}("");
        require(sent, "Failed to send platform fee");

        emit PredictionResolved(_id, _result, totalPool - fee, fee);
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

        // Send fee to admin immediately
        (bool sent, ) = admin.call{value: fee}("");
        require(sent, "Failed to send platform fee");

        emit PredictionVoided(_id, totalPool - fee, fee);
    }

    // 4. Distribute Winnings (Batch Processing)
    function distributeWinnings(string memory _id, uint256 _batchSize) external onlyAdminOrOperator {
        Prediction storage p = predictions[_id];
        require(p.resolved, "Prediction not resolved yet");
        require(!p.paidOut, "Already fully paid out");

        address[] memory winners;
        uint256 totalPool = p.totalYes + p.totalNo;
        uint256 fee = (totalPool * platformFeeBps) / 10000;
        uint256 distributablePot = totalPool - fee;
        
        // --- VOID LOGIC ---
        if (p.isVoid) {
            // Need to iterate through ALL bettors (YES and NO)
            // Ideally we'd have a single array of allBettors, but we have two.
            // Complex to do in one loop if sizes differ.
            // Better strategy: Treat them as a single virtual list.
            
            uint256 totalYesCount = p.yesBettors.length;
            uint256 totalNoCount = p.noBettors.length;
            uint256 totalBettors = totalYesCount + totalNoCount;
            
            uint256 endIndex = p.processedIndex + _batchSize;
            if (endIndex > totalBettors) endIndex = totalBettors;

            for (uint256 i = p.processedIndex; i < endIndex; i++) {
                address userAddr;
                uint256 betAmount;
                
                if (i < totalYesCount) {
                    // Processing YES bettors
                    userAddr = p.yesBettors[i];
                    betAmount = p.yesBets[userAddr];
                    p.yesBets[userAddr] = 0; 
                } else {
                    // Processing NO bettors
                    uint256 noIndex = i - totalYesCount;
                    userAddr = p.noBettors[noIndex];
                    betAmount = p.noBets[userAddr];
                    p.noBets[userAddr] = 0;
                }

                if (betAmount > 0) {
                    // Refund calculation: (UserBet / TotalPool) * Distributable
                    // Or simply: UserBet * (0.8) if fee is constant 20%
                    // Using (betAmount * distributablePot) / totalPool is safer for precision
                    uint256 refund = (betAmount * distributablePot) / totalPool;
                    
                    (bool sent, ) = userAddr.call{value: refund}("");
                    require(sent, "Transfer failed"); 
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

        // --- NORMAL LOGIC (Win/Loss) ---
        uint256 winningPool;
        
        if (p.result) { // YES won
            winners = p.yesBettors;
            winningPool = p.totalYes;
        } else { // NO won
            winners = p.noBettors;
            winningPool = p.totalNo;
        }

        if (winners.length == 0) {
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
                uint256 payout = (betAmount * distributablePot) / winningPool;
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

