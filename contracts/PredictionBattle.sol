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
        uint256 processedIndex; // To track how many winners have been paid (for batching)
        bool paidOut;
    }

    mapping(string => Prediction) public predictions;
    mapping(string => bool) public predictionExists;

    event PredictionCreated(string id, uint256 target, uint256 deadline);
    event BetPlaced(string id, address user, bool vote, uint256 amount);
    event PredictionResolved(string id, bool result, uint256 winnerPool, uint256 platformFee);
    event PayoutDistributed(string id, address user, uint256 amount);
    event DistributionCompleted(string id);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // 1. Create a Prediction Market
    function createPrediction(string memory _id, uint256 _target, uint256 _duration) external onlyAdmin {
        require(!predictionExists[_id], "Prediction ID already exists");
        
        Prediction storage p = predictions[_id];
        p.id = _id;
        p.target = _target;
        p.deadline = block.timestamp + _duration;
        p.resolved = false;
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
            // Add to array only if first time betting or logic dictates (here we allow multiple bets, but strictly unique address tracking needs care)
            // Ideally we check if they already bet to avoid duplicate array entries, OR we just append and handle duplicates in loop (more gas first time, easier later).
            // Cheaper for user: Append. More expensive for admin: Duplicates. 
            // Let's Check duplicates to save admin gas later.
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
    function resolvePrediction(string memory _id, bool _result) external onlyAdmin {
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

    // 4. Distribute Winnings (Batch Processing)
    // _batchSize: number of users to process in this call (e.g., 50)
    function distributeWinnings(string memory _id, uint256 _batchSize) external onlyAdmin {
        Prediction storage p = predictions[_id];
        require(p.resolved, "Prediction not resolved yet");
        require(!p.paidOut, "Already fully paid out");

        address[] memory winners;
        uint256 winningPool;
        uint256 losingPool;

        if (p.result) { // YES won
            winners = p.yesBettors;
            winningPool = p.totalYes;
            losingPool = p.totalNo;
        } else { // NO won
            winners = p.noBettors;
            winningPool = p.totalNo;
            losingPool = p.totalYes;
        }

        if (winners.length == 0) {
            p.paidOut = true;
            return;
        }

        uint256 totalWinners = winners.length;
        uint256 endIndex = p.processedIndex + _batchSize;
        if (endIndex > totalWinners) {
            endIndex = totalWinners;
        }

        // Pot Calculation matching claim logic
        uint256 totalPool = winningPool + losingPool;
        uint256 fee = (totalPool * platformFeeBps) / 10000;
        uint256 distributablePot = totalPool - fee;

        for (uint256 i = p.processedIndex; i < endIndex; i++) {
            address winnerAddr = winners[i];
            uint256 betAmount;
            
            if (p.result) {
                betAmount = p.yesBets[winnerAddr];
                // Reset to prevent re-entrancy/double pay effectively handled by processedIndex but good practice
                p.yesBets[winnerAddr] = 0; 
            } else {
                betAmount = p.noBets[winnerAddr];
                p.noBets[winnerAddr] = 0;
            }

            if (betAmount > 0) {
                uint256 payout = (betAmount * distributablePot) / winningPool;
                (bool sent, ) = winnerAddr.call{value: payout}("");
                require(sent, "Transfer failed"); // If one fails, batch fails. Safer for ensuring everyone gets paid.
                emit PayoutDistributed(_id, winnerAddr, payout);
            }
        }

        p.processedIndex = endIndex;

        if (p.processedIndex >= totalWinners) {
            p.paidOut = true;
            emit DistributionCompleted(_id);
        }
    }
}
