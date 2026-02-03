// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionBattleV7_SECURE
 * @notice Versão corrigida com as principais vulnerabilidades resolvidas
 * @dev Este contrato implementa as correções críticas identificadas na auditoria
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title PredictionBattleV7
 * @dev Contrato de mercados de previsão com correções de segurança
 */
contract PredictionBattleV7_SECURE is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    
    // ============ STATE VARIABLES ============
    
    address public treasury;
    IERC20 public immutable usdcToken;
    
    // Constants
    uint256 public constant DISPUTE_BLOCKS = 3600; // ~12h em blocos (assumindo 12s/bloco)
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant SHARE_PRECISION = 1e18;
    uint256 public constant MAX_WEIGHT = 150; // 1.5x
    uint256 public constant MIN_WEIGHT = 100; // 1.0x
    uint256 public constant REPORTER_REWARD_BPS = 100; // 1%
    
    // Configurable fees
    uint256 public houseFeeBps = 1000;   // 10%
    uint256 public creatorFeeBps = 500;  // 5%
    uint256 public referrerFeeBps = 500; // 5%
    
    // Circuit breakers
    uint256 public maxBetAmount = 100_000 * 1e6; // 100k USDC
    uint256 public maxMarketPool = 1_000_000 * 1e6; // 1M USDC
    uint256 public constant MAX_BETTORS_PER_SIDE = 10000;
    
    // Rate limiting
    mapping(address => uint256) public lastMarketCreation;
    uint256 public constant MIN_MARKET_INTERVAL = 1 hours;
    
    // Balances
    uint256 public houseBalance;
    mapping(address => uint256) public creatorBalance;
    mapping(address => uint256) public rewardsBalance;
    mapping(address => uint256) public claimableBonds;
    
    // Timelock for treasury changes only
    uint256 public constant TREASURY_TIMELOCK = 2 days;
    mapping(bytes32 => uint256) public pendingTreasuryChange;
    
    // ============ STRUCTS ============
    
    struct Market {
        string id;
        address creator;
        string question;
        uint256 creationBlock;
        uint256 bonusDuration;
        uint256 deadlineBlock;
        MarketState state;
        bool result;
        bool isVoid;
        
        // Proposal Info
        address proposer;
        bool proposedResult;
        uint256 proposalBlock;
        uint256 bondAmount;
        string evidenceUrl;
        
        // Dispute Info
        address challenger;
        uint256 challengeBondAmount;
        string challengeEvidenceUrl;
        uint256 challengeBlock;
        
        // Pool Tracking
        uint256 totalYes;
        uint256 totalNo;
        uint256 seedYes;
        uint256 seedNo;
        
        // Shares Tracking
        uint256 totalSharesYes;
        uint256 totalSharesNo;
    }
    
    struct UserBet {
        uint256 amount;
        uint256 shares;
        address referrer;
        bool claimed;
    }
    
    enum MarketState {
        OPEN,
        LOCKED,
        PROPOSED,
        DISPUTED,
        RESOLVED
    }
    
    // ============ MAPPINGS ============
    
    mapping(string => Market) public markets;
    mapping(string => bool) public marketExists;
    mapping(string => mapping(address => UserBet)) public yesBets;
    mapping(string => mapping(address => UserBet)) public noBets;
    mapping(string => mapping(address => bool)) public hasClaimed;
    mapping(string => bool) public seedWithdrawn;
    
    // Use EnumerableSet instead of arrays
    mapping(string => EnumerableSet.AddressSet) private yesBettorsSet;
    mapping(string => EnumerableSet.AddressSet) private noBettorsSet;
    
    // ============ EVENTS ============
    
    event MarketCreated(
        string indexed id, 
        address indexed creator, 
        uint256 deadlineBlock, 
        uint256 bonusDuration
    );
    
    event BetPlaced(
        string indexed id, 
        address indexed user, 
        bool side, 
        uint256 amount, 
        uint256 shares, 
        address referrer, 
        uint256 weight
    );
    
    event MarketStateChanged(
        string indexed marketId, 
        MarketState oldState, 
        MarketState newState
    );
    
    event OutcomeProposed(
        string indexed id, 
        address indexed proposer, 
        bool result, 
        uint256 bond, 
        uint256 disputeEndBlock, 
        string evidence
    );
    
    event OutcomeChallenged(
        string indexed id, 
        address indexed challenger, 
        uint256 bond, 
        string evidence
    );
    
    event DisputeResolved(
        string indexed id, 
        address indexed winner, 
        uint256 totalBondReward, 
        bool finalResult
    );
    
    event OutcomeFinalized(
        string indexed id, 
        address indexed proposer, 
        uint256 reward
    );
    
    event MarketResolved(
        string indexed id, 
        bool result, 
        uint256 winnerPool
    );
    
    event MarketVoided(string indexed id);
    
    event PayoutClaimed(
        string indexed id, 
        address indexed user, 
        uint256 amount
    );
    
    event SeedWithdrawn(
        string indexed id, 
        address indexed creator, 
        uint256 amount
    );
    
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TreasuryChangeProposed(address indexed newTreasury, uint256 executeTime);
    event HouseFeeWithdrawn(address indexed treasury, uint256 amount);
    event BondWithdrawn(address indexed user, uint256 amount);
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Inicializa o contrato
     * @param _usdcAddress Endereço do token USDC
     * @param _initialAdmin Admin inicial
     * @param _treasury Endereço do tesouro
     */
    constructor(
        address _usdcAddress,
        address _initialAdmin,
        address _treasury
    ) Ownable(_initialAdmin) {
        require(_usdcAddress != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid Treasury");
        
        // Verificar se USDC é um contrato
        uint256 size;
        assembly { size := extcodesize(_usdcAddress) }
        require(size > 0, "USDC must be contract");
        
        treasury = _treasury;
        usdcToken = IERC20(_usdcAddress);
    }
    
    /**
     * @notice Propõe mudança de tesouro (com timelock de 2 dias)
     * @param _newTreasury Novo endereço do tesouro
     */
    function proposeTreasuryChange(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid address");
        
        bytes32 changeHash = keccak256(abi.encode(_newTreasury));
        pendingTreasuryChange[changeHash] = block.timestamp + TREASURY_TIMELOCK;
        
        emit TreasuryChangeProposed(_newTreasury, block.timestamp + TREASURY_TIMELOCK);
    }
    
    /**
     * @notice Executa mudança de tesouro após timelock
     * @param _newTreasury Novo endereço do tesouro (deve ser o mesmo da proposta)
     */
    function executeTreasuryChange(address _newTreasury) external onlyOwner {
        bytes32 changeHash = keccak256(abi.encode(_newTreasury));
        require(pendingTreasuryChange[changeHash] != 0, "Not proposed");
        require(block.timestamp >= pendingTreasuryChange[changeHash], "Timelock active");
        
        address oldTreasury = treasury;
        treasury = _newTreasury;
        
        delete pendingTreasuryChange[changeHash];
        
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }
    
    /**
     * @notice Pausa o contrato em emergência
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Despausa o contrato
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ MARKET CREATION ============
    
    /**
     * @notice Cria um novo mercado de previsão
     * @param _id ID único do mercado
     * @param _question Pergunta do mercado
     * @param _usdcSeedAmount Quantidade de seed (deve ser par)
     * @param _durationBlocks Duração em blocos
     * @param _bonusDurationBlocks Duração do bônus em blocos
     */
    function createMarket(
        string calldata _id,
        string calldata _question,
        uint256 _usdcSeedAmount,
        uint256 _durationBlocks,
        uint256 _bonusDurationBlocks
    ) external whenNotPaused nonReentrant {
        // Validações de entrada
        require(bytes(_id).length > 0 && bytes(_id).length <= 64, "Invalid ID length");
        require(bytes(_question).length >= 10 && bytes(_question).length <= 500, "Invalid question length");
        require(!marketExists[_id], "Market exists");
        require(_usdcSeedAmount > 0 && _usdcSeedAmount % 2 == 0, "Invalid seed");
        require(_usdcSeedAmount <= maxMarketPool, "Seed too large");
        require(_durationBlocks > 0, "Invalid duration");
        
        // Rate limiting
        require(
            block.timestamp >= lastMarketCreation[msg.sender] + MIN_MARKET_INTERVAL,
            "Rate limit"
        );
        lastMarketCreation[msg.sender] = block.timestamp;
        
        // Transfer seed (usando SafeERC20)
        usdcToken.safeTransferFrom(msg.sender, address(this), _usdcSeedAmount);
        
        // Criar mercado
        Market storage m = markets[_id];
        m.id = _id;
        m.creator = msg.sender;
        m.question = _question;
        m.creationBlock = block.number;
        m.bonusDuration = _bonusDurationBlocks > 0 ? _bonusDurationBlocks : _durationBlocks;
        m.deadlineBlock = block.number + _durationBlocks;
        m.state = MarketState.OPEN;
        
        uint256 seedPerSide = _usdcSeedAmount / 2;
        m.totalYes = seedPerSide;
        m.totalNo = seedPerSide;
        m.seedYes = seedPerSide;
        m.seedNo = seedPerSide;
        
        marketExists[_id] = true;
        
        emit MarketCreated(_id, msg.sender, m.deadlineBlock, _bonusDurationBlocks);
    }
    
    // ============ BETTING ============
    
    /**
     * @notice Coloca uma aposta em um mercado
     * @param _marketId ID do mercado
     * @param _side true para YES, false para NO
     * @param _usdcAmount Quantidade a apostar
     * @param _referrer Endereço do referenciador (opcional)
     */
    function placeBet(
        string calldata _marketId,
        bool _side,
        uint256 _usdcAmount,
        address _referrer
    ) external whenNotPaused nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        
        // Validações
        require(m.state == MarketState.OPEN, "Not open");
        require(block.number < m.deadlineBlock, "Expired");
        require(_usdcAmount > 0, "Zero amount");
        require(_usdcAmount <= maxBetAmount, "Bet too large");
        
        // Verificar limite do pool
        uint256 newTotal = m.totalYes + m.totalNo + _usdcAmount;
        require(newTotal <= maxMarketPool, "Pool limit exceeded");
        
        // Validar referrer
        require(_referrer != msg.sender, "Cannot self-refer");
        require(!_isContract(_referrer), "Referrer cannot be contract");
        
        // Transfer (usando SafeERC20)
        usdcToken.safeTransferFrom(msg.sender, address(this), _usdcAmount);
        
        // Calcular taxas
        uint256 houseFee = (_usdcAmount * houseFeeBps) / FEE_DENOMINATOR;
        uint256 creatorFee = (_usdcAmount * creatorFeeBps) / FEE_DENOMINATOR;
        uint256 referrerFee = 0;
        
        if (_referrer != address(0) && _referrer != m.creator) {
            referrerFee = (_usdcAmount * referrerFeeBps) / FEE_DENOMINATOR;
            rewardsBalance[_referrer] += referrerFee;
        }
        
        uint256 netAmount = _usdcAmount - houseFee - creatorFee - referrerFee;
        
        // Atualizar saldos
        houseBalance += houseFee;
        creatorBalance[m.creator] += creatorFee;
        
        // Calcular shares
        uint256 shares = _calculateShares(
            _side ? m.totalYes : m.totalNo,
            _side ? m.totalNo : m.totalYes,
            netAmount
        );
        
        // Atualizar pools
        if (_side) {
            m.totalYes += netAmount;
            m.totalSharesYes += shares;
        } else {
            m.totalNo += netAmount;
            m.totalSharesNo += shares;
        }
        
        // Atualizar aposta do usuário
        UserBet storage userBet = _side ? yesBets[_marketId][msg.sender] : noBets[_marketId][msg.sender];
        userBet.amount += netAmount;
        userBet.shares += shares;
        userBet.referrer = _referrer;
        
        // Adicionar ao set (com limite)
        EnumerableSet.AddressSet storage bettorsSet = _side ? yesBettorsSet[_marketId] : noBettorsSet[_marketId];
        require(bettorsSet.length() < MAX_BETTORS_PER_SIDE, "Max bettors reached");
        bettorsSet.add(msg.sender);
        
        uint256 weight = _calculateWeight(
            _side ? m.totalNo : m.totalYes,
            _side ? m.totalYes : m.totalNo
        );
        
        emit BetPlaced(_marketId, msg.sender, _side, netAmount, shares, _referrer, weight);
    }
    
    // ============ OUTCOME PROPOSAL ============
    
    /**
     * @notice Propõe um resultado para o mercado
     * @param _marketId ID do mercado
     * @param _result Resultado proposto
     * @param _evidenceUrl URL da evidência
     * @param _bondAmount Quantidade de bond
     */
    function proposeOutcome(
        string calldata _marketId,
        bool _result,
        string calldata _evidenceUrl,
        uint256 _bondAmount
    ) external whenNotPaused nonReentrant {
        require(marketExists[_marketId], "No market");
        require(bytes(_evidenceUrl).length <= 256, "Evidence URL too long");
        
        Market storage m = markets[_marketId];
        require(m.state == MarketState.OPEN || m.state == MarketState.LOCKED, "Invalid state");
        require(block.number >= m.deadlineBlock, "Not ended");
        require(_bondAmount > 0, "No bond");
        
        // Transfer bond
        usdcToken.safeTransferFrom(msg.sender, address(this), _bondAmount);
        
        // Atualizar estado
        _updateMarketState(m, MarketState.PROPOSED);
        
        m.proposer = msg.sender;
        m.proposedResult = _result;
        m.proposalBlock = block.number;
        m.bondAmount = _bondAmount;
        m.evidenceUrl = _evidenceUrl;
        
        uint256 disputeEndBlock = block.number + DISPUTE_BLOCKS;
        
        emit OutcomeProposed(_marketId, msg.sender, _result, _bondAmount, disputeEndBlock, _evidenceUrl);
    }
    
    // ============ DISPUTE ============
    
    /**
     * @notice Desafia o resultado proposto
     * @param _marketId ID do mercado
     * @param _evidenceUrl URL da evidência
     * @param _bondAmount Quantidade de bond
     */
    function challengeOutcome(
        string calldata _marketId,
        string calldata _evidenceUrl,
        uint256 _bondAmount
    ) external whenNotPaused nonReentrant {
        require(marketExists[_marketId], "No market");
        require(bytes(_evidenceUrl).length <= 256, "Evidence URL too long");
        
        Market storage m = markets[_marketId];
        require(m.state == MarketState.PROPOSED, "Not proposed");
        require(block.number <= m.proposalBlock + DISPUTE_BLOCKS, "Window closed");
        require(_bondAmount >= m.bondAmount, "Insufficient bond");
        require(msg.sender != m.proposer, "Cannot self-challenge");
        
        // Transfer bond
        usdcToken.safeTransferFrom(msg.sender, address(this), _bondAmount);
        
        // Atualizar estado
        _updateMarketState(m, MarketState.DISPUTED);
        
        m.challenger = msg.sender;
        m.challengeBondAmount = _bondAmount;
        m.challengeEvidenceUrl = _evidenceUrl;
        m.challengeBlock = block.number;
        
        emit OutcomeChallenged(_marketId, msg.sender, _bondAmount, _evidenceUrl);
    }
    
    /**
     * @notice Resolve uma disputa (imediato, sem timelock)
     * @param _marketId ID do mercado
     * @param _winnerAddress Endereço do vencedor (proposer ou challenger)
     * @param _finalResult Resultado final do mercado
     */
    function resolveDispute(
        string calldata _marketId,
        address _winnerAddress,
        bool _finalResult
    ) external onlyOwner nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.DISPUTED, "Not disputed");
        require(_winnerAddress == m.proposer || _winnerAddress == m.challenger, "Invalid winner");
        
        uint256 totalBond = m.bondAmount + m.challengeBondAmount;
        
        // Calcular recompensa (1% do pool total)
        uint256 totalPool = m.totalYes + m.totalNo;
        require(totalPool > 0, "Empty pool");
        
        uint256 reward = (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
        
        if (reward > 0 && houseBalance >= reward) {
            houseBalance -= reward;
            totalBond += reward;
        }
        
        // Creditar ao vencedor (pull pattern)
        claimableBonds[_winnerAddress] += totalBond;
        
        // Atualizar estado
        _updateMarketState(m, MarketState.RESOLVED);
        m.result = _finalResult;
        m.bondAmount = 0;
        m.challengeBondAmount = 0;
        
        emit DisputeResolved(_marketId, _winnerAddress, totalBond, _finalResult);
        emit MarketResolved(_marketId, _finalResult, _finalResult ? m.totalYes : m.totalNo);
    }
    
    // ============ FINALIZATION ============
    
    /**
     * @notice Finaliza resultado após janela de disputa
     * @param _marketId ID do mercado
     */
    function finalizeOutcome(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        
        require(m.state == MarketState.PROPOSED, "Not proposed");
        require(block.number > m.proposalBlock + DISPUTE_BLOCKS, "Window active");
        
        address proposer = m.proposer;
        uint256 bondAmount = m.bondAmount;
        
        // Calcular recompensa
        uint256 totalPool = m.totalYes + m.totalNo;
        require(totalPool > 0, "Empty pool");
        
        uint256 reward = (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
        uint256 totalPayout = bondAmount;
        
        if (reward > 0 && houseBalance >= reward) {
            houseBalance -= reward;
            totalPayout += reward;
        }
        
        // Creditar ao proposer (pull pattern)
        claimableBonds[proposer] += totalPayout;
        
        // Atualizar estado
        _updateMarketState(m, MarketState.RESOLVED);
        m.result = m.proposedResult;
        m.bondAmount = 0;
        
        emit OutcomeFinalized(_marketId, proposer, reward);
        emit MarketResolved(_marketId, m.result, m.result ? m.totalYes : m.totalNo);
    }
    
    // ============ CLAIMS ============
    
    /**
     * @notice Reivindica prêmios de uma aposta vencedora
     * @param _marketId ID do mercado
     */
    function claimWinnings(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(!hasClaimed[_marketId][msg.sender], "Already claimed");
        
        uint256 payout = 0;
        UserBet storage yesBet = yesBets[_marketId][msg.sender];
        UserBet storage noBet = noBets[_marketId][msg.sender];
        
        if (m.isVoid) {
            // Mercado anulado: devolver ambas as apostas
            payout = yesBet.amount + noBet.amount;
        } else {
            // Mercado resolvido: calcular payout
            bool isYesWinner = m.result;
            UserBet storage winningBet = isYesWinner ? yesBet : noBet;
            
            if (winningBet.amount > 0 && winningBet.shares > 0) {
                uint256 totalPool = m.totalYes + m.totalNo;
                require(totalPool > 0, "Empty pool");
                
                uint256 totalFees = (totalPool * (houseFeeBps + creatorFeeBps + referrerFeeBps)) / FEE_DENOMINATOR;
                uint256 distributablePool = totalPool - totalFees;
                
                uint256 totalWinningShares = isYesWinner ? m.totalSharesYes : m.totalSharesNo;
                require(totalWinningShares > 0, "No winning shares");
                
                payout = (winningBet.shares * distributablePool) / totalWinningShares;
            }
        }
        
        require(payout > 0, "Nothing to claim");
        
        // CRITICAL: Atualizar estado ANTES da transferência (Checks-Effects-Interactions)
        hasClaimed[_marketId][msg.sender] = true;
        if (yesBet.amount > 0) yesBet.claimed = true;
        if (noBet.amount > 0) noBet.claimed = true;
        
        // Transferir (usando SafeERC20)
        usdcToken.safeTransfer(msg.sender, payout);
        
        emit PayoutClaimed(_marketId, msg.sender, payout);
    }
    
    /**
     * @notice Retira seed de mercado anulado
     * @param _marketId ID do mercado
     */
    function withdrawSeed(string calldata _marketId) external nonReentrant {
        require(marketExists[_marketId], "No market");
        Market storage m = markets[_marketId];
        require(m.state == MarketState.RESOLVED, "Not resolved");
        require(m.isVoid, "Not void");
        require(msg.sender == m.creator, "Only creator");
        require(!seedWithdrawn[_marketId], "Already withdrawn");
        
        uint256 totalSeed = m.seedYes + m.seedNo;
        require(totalSeed > 0, "No seed");
        
        // CRITICAL: Atualizar estado ANTES da transferência
        seedWithdrawn[_marketId] = true;
        
        usdcToken.safeTransfer(msg.sender, totalSeed);
        
        emit SeedWithdrawn(_marketId, msg.sender, totalSeed);
    }
    
    /**
     * @notice Retira bonds acumulados
     */
    function withdrawBond() external nonReentrant {
        uint256 amount = claimableBonds[msg.sender];
        require(amount > 0, "No bonds");
        
        // CRITICAL: Atualizar estado ANTES da transferência
        claimableBonds[msg.sender] = 0;
        
        usdcToken.safeTransfer(msg.sender, amount);
        
        emit BondWithdrawn(msg.sender, amount);
    }
    
    // ============ FEE WITHDRAWALS ============
    
    /**
     * @notice Retira taxas do criador
     */
    function withdrawCreatorFees() external nonReentrant {
        uint256 amount = creatorBalance[msg.sender];
        require(amount > 0, "No fees");
        
        // CRITICAL: Atualizar estado ANTES da transferência
        creatorBalance[msg.sender] = 0;
        
        usdcToken.safeTransfer(msg.sender, amount);
    }
    
    /**
     * @notice Retira taxas de referência
     */
    function withdrawReferrerFees() external nonReentrant {
        uint256 amount = rewardsBalance[msg.sender];
        require(amount > 0, "No fees");
        
        // CRITICAL: Atualizar estado ANTES da transferência
        rewardsBalance[msg.sender] = 0;
        
        usdcToken.safeTransfer(msg.sender, amount);
    }
    
    /**
     * @notice Retira taxas da casa para o tesouro
     */
    function withdrawHouseFees() external onlyOwner nonReentrant {
        uint256 amount = houseBalance;
        require(amount > 0, "No fees");
        
        // CRITICAL: Atualizar estado ANTES da transferência
        houseBalance = 0;
        
        usdcToken.safeTransfer(treasury, amount);
        
        emit HouseFeeWithdrawn(treasury, amount);
    }
    
    // ============ ADMIN EMERGENCY ============
    
    /**
     * @notice Anula um mercado (emergência)
     * @param _marketId ID do mercado
     */
    function voidMarket(string calldata _marketId) external onlyOwner {
        Market storage m = markets[_marketId];
        require(m.state != MarketState.RESOLVED, "Already resolved");
        
        // Devolver bonds via pull pattern
        if (m.bondAmount > 0) {
            claimableBonds[m.proposer] += m.bondAmount;
            m.bondAmount = 0;
        }
        if (m.challengeBondAmount > 0) {
            claimableBonds[m.challenger] += m.challengeBondAmount;
            m.challengeBondAmount = 0;
        }
        
        _updateMarketState(m, MarketState.RESOLVED);
        m.isVoid = true;
        
        emit MarketVoided(_marketId);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Retorna detalhes de um mercado
     * @param _marketId ID do mercado
     */
    function getMarketDetails(string calldata _marketId) external view returns (
        MarketState state,
        bool result,
        uint256 totalYes,
        uint256 totalNo,
        uint256 deadlineBlock,
        address creator,
        bool isVoid
    ) {
        Market storage m = markets[_marketId];
        return (
            m.state,
            m.result,
            m.totalYes,
            m.totalNo,
            m.deadlineBlock,
            m.creator,
            m.isVoid
        );
    }
    
    /**
     * @notice Retorna apostas de um usuário
     * @param _marketId ID do mercado
     * @param _user Endereço do usuário
     */
    function getUserBets(string calldata _marketId, address _user) external view returns (
        uint256 yesAmount,
        uint256 noAmount,
        uint256 yesShares,
        uint256 noShares,
        bool claimed
    ) {
        UserBet storage yesBet = yesBets[_marketId][_user];
        UserBet storage noBet = noBets[_marketId][_user];
        
        return (
            yesBet.amount,
            noBet.amount,
            yesBet.shares,
            noBet.shares,
            hasClaimed[_marketId][_user]
        );
    }
    
    /**
     * @notice Retorna número de apostadores por lado
     * @param _marketId ID do mercado
     */
    function getBettorsCount(string calldata _marketId) external view returns (
        uint256 yesCount,
        uint256 noCount
    ) {
        return (
            yesBettorsSet[_marketId].length(),
            noBettorsSet[_marketId].length()
        );
    }
    
    /**
     * @notice Calcula payout potencial para um usuário
     * @param _marketId ID do mercado
     * @param _user Endereço do usuário
     */
    function calculatePotentialPayout(
        string calldata _marketId,
        address _user,
        bool _assumedResult
    ) external view returns (uint256) {
        Market storage m = markets[_marketId];
        
        bool isYesWinner = _assumedResult;
        UserBet storage winningBet = isYesWinner ? yesBets[_marketId][_user] : noBets[_marketId][_user];
        
        if (winningBet.amount == 0 || winningBet.shares == 0) {
            return 0;
        }
        
        uint256 totalPool = m.totalYes + m.totalNo;
        if (totalPool == 0) return 0;
        
        uint256 totalFees = (totalPool * (houseFeeBps + creatorFeeBps + referrerFeeBps)) / FEE_DENOMINATOR;
        uint256 distributablePool = totalPool - totalFees;
        
        uint256 totalWinningShares = isYesWinner ? m.totalSharesYes : m.totalSharesNo;
        if (totalWinningShares == 0) return 0;
        
        return (winningBet.shares * distributablePool) / totalWinningShares;
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @notice Calcula shares baseado no ratio do pool
     */
    function _calculateShares(
        uint256 targetPool,
        uint256 oppositePool,
        uint256 amount
    ) internal pure returns (uint256) {
        if (targetPool == 0 || oppositePool == 0) {
            return amount * SHARE_PRECISION;
        }
        
        require(oppositePool <= type(uint128).max, "Pool overflow");
        require(targetPool > 0, "Target pool zero");
        
        uint256 ratio = (oppositePool * SHARE_PRECISION) / targetPool;
        uint256 weight = (ratio * 100) / SHARE_PRECISION;
        
        if (weight < MIN_WEIGHT) weight = MIN_WEIGHT;
        if (weight > MAX_WEIGHT) weight = MAX_WEIGHT;
        
        return (amount * SHARE_PRECISION * weight) / 100;
    }
    
    /**
     * @notice Calcula weight para evento
     */
    function _calculateWeight(
        uint256 oppositePool,
        uint256 targetPool
    ) internal pure returns (uint256) {
        if (targetPool == 0 || oppositePool == 0) {
            return MIN_WEIGHT;
        }
        
        uint256 ratio = (oppositePool * SHARE_PRECISION) / targetPool;
        uint256 weight = (ratio * 100) / SHARE_PRECISION;
        
        if (weight < MIN_WEIGHT) return MIN_WEIGHT;
        if (weight > MAX_WEIGHT) return MAX_WEIGHT;
        
        return weight;
    }
    
    /**
     * @notice Atualiza estado do mercado com evento
     */
    function _updateMarketState(Market storage m, MarketState newState) internal {
        MarketState oldState = m.state;
        m.state = newState;
        emit MarketStateChanged(m.id, oldState, newState);
    }
    
    /**
     * @notice Verifica se endereço é contrato
     */
    function _isContract(address addr) internal view returns (bool) {
        if (addr == address(0)) return false;
        uint256 size;
        assembly { size := extcodesize(addr) }
        return size > 0;
    }
}
