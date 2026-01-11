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
        bool isVoid;
        uint256 processedIndex;
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

    // 1. Create a Prediction Market (Anyone can create)
    function createPrediction(string memory _id, uint256 _target, uint256 _duration) external {
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

        // Calculate Fee
        uint256 totalPool = p.totalYes + p.totalNo;
        uint256 fee = (totalPool * platformFeeBps) / 10000;
        
        // Send fee to admin (deployer/owner)
        require(usdcToken.transfer(admin, fee), "Failed to send platform fee");

        emit PredictionResolved(_id, _result, totalPool - fee, fee);
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
        uint256 fee = (totalPool * platformFeeBps) / 10000;
        uint256 distributablePot = totalPool - fee;
        
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
}
