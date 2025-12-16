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
        mapping(address => uint256) yesBets;
        mapping(address => uint256) noBets;
    }

    mapping(string => Prediction) public predictions;
    mapping(string => bool) public predictionExists;

    event PredictionCreated(string id, uint256 target, uint256 deadline);
    event BetPlaced(string id, address user, bool vote, uint256 amount);
    event PredictionResolved(string id, bool result, uint256 winnerPool, uint256 platformFee);
    event WinningsClaimed(string id, address user, uint256 amount);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    // 1. Create a Prediction Market
    function createPrediction(string memory _id, uint256 _target, uint256 _duration) external onlyAdmin {
        require(!predictionExists[_id], "Prediction ID already exists");
        
        Prediction storage p = predictions[_id];
        p.id = _id;
        p.target = _target;
        p.deadline = block.timestamp + _duration;
        p.resolved = false;
        
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
            p.yesBets[msg.sender] += msg.value;
            p.totalYes += msg.value;
        } else {
            p.noBets[msg.sender] += msg.value;
            p.totalNo += msg.value;
        }

        emit BetPlaced(_id, msg.sender, _vote, msg.value);
    }

    // 3. Resolve Prediction (Admin sets winner)
    function resolvePrediction(string memory _id, bool _result) external onlyAdmin {
        require(predictionExists[_id], "Prediction does not exist");
        Prediction storage p = predictions[_id];
        require(!p.resolved, "Already resolved");
        // We allow resolving before deadline if the event clearly happened? 
        // Or enforce deadline? Let's strictly enforce usage after deadline for now, 
        // but admin might need to resolve early if target hit.
        
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

    // 4. Claim Winnings (Pull Payment)
    function claimWinnings(string memory _id) external {
        Prediction storage p = predictions[_id];
        require(p.resolved, "Prediction not resolved yet");

        uint256 userBet;
        uint256 winningPool;
        uint256 losingPool;

        if (p.result) { // YES won
            userBet = p.yesBets[msg.sender];
            winningPool = p.totalYes;
            losingPool = p.totalNo;
        } else { // NO won
            userBet = p.noBets[msg.sender];
            winningPool = p.totalNo;
            losingPool = p.totalYes;
        }

        require(userBet > 0, "No winning bet found for user");

        // Calculate share
        // Total Pot = WinningPool + LosingPool
        // Fee = 20%
        // Net Pot = (WinningPool + LosingPool) * 0.8
        // User Share = (UserBet / WinningPool) * Net Pot
        
        // Simplified: User gets their bet back + share of losing pool (minus fee)
        // Let's stick to the 80/20 of TOTAL POT logic
        uint256 totalPool = winningPool + losingPool;
        uint256 fee = (totalPool * platformFeeBps) / 10000;
        uint256 distributablePot = totalPool - fee;

        uint256 payout = (userBet * distributablePot) / winningPool;

        // Reset user bet to 0 to prevent double claim
        if (p.result) {
            p.yesBets[msg.sender] = 0;
        } else {
            p.noBets[msg.sender] = 0;
        }

        (bool sent, ) = msg.sender.call{value: payout}("");
        require(sent, "Failed to send winnings");

        emit WinningsClaimed(_id, msg.sender, payout);
    }
}
