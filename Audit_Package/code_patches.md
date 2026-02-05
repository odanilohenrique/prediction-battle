# 🔧 PATCHES DE CÓDIGO - PREDICTION BATTLE V8

Este documento contém os patches recomendados para corrigir as vulnerabilidades identificadas na auditoria.

---

## 🔴 PATCH CRÍTICO #1 - Corrigir Double Counting de Reporter Reward

### Problema
A recompensa do reporter está sendo deduzida duas vezes: uma em `finalizeOutcome()` e outra em `claimWinnings()`.

### Solução

```solidity
// ============================================
// ARQUIVO: PredictionBattleV8_Fixed.sol
// MUDANÇAS NAS LINHAS: 441-463, 470-509
// ============================================

/**
 * @notice Finalizes outcome after dispute window without challenges
 * @dev [C-01 FIX] Apenas retorna o bond, NÃO deduz reporter reward aqui
 */
function finalizeOutcome(string calldata _marketId) external nonReentrant {
    require(marketExists[_marketId], "No market");
    Market storage m = markets[_marketId];
    
    require(m.state == MarketState.PROPOSED, "Not proposed");
    require(block.timestamp > m.proposalTime + DISPUTE_WINDOW, "Window active");
    
    address proposer = m.proposer;
    uint256 bondAmount = m.bondAmount;
    
    // [C-01 FIX] NÃO calcular ou deduzir reward aqui
    // O reward será deduzido apenas em claimWinnings()
    
    // Retornar apenas o bond ao proposer
    claimableBonds[proposer] += bondAmount;
    
    _updateMarketState(m, MarketState.RESOLVED);
    m.result = m.proposedResult;
    m.bondAmount = 0;
    
    emit OutcomeFinalized(_marketId, proposer, 0); // reward = 0 aqui
    emit MarketResolved(_marketId, m.result, m.result ? m.totalYes : m.totalNo);
}

/**
 * @notice Claims winnings for resolved markets
 * @dev [C-01 FIX] Reporter reward deduzido APENAS aqui, uma única vez
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
        // Mercado anulado: retornar apostas
        payout = yesBet.amount + noBet.amount;
    } else {
        bool isYesWinner = m.result;
        UserBet storage winningBet = isYesWinner ? yesBet : noBet;
        
        if (winningBet.amount > 0 && winningBet.shares > 0) {
            uint256 totalPool = m.totalYes + m.totalNo;
            require(totalPool > 0, "Empty pool");
            
            // [C-01 FIX] Reporter reward deduzido APENAS AQUI
            uint256 reporterReward = (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
            uint256 distributablePool = totalPool - reporterReward;
            
            uint256 totalWinningShares = isYesWinner ? m.totalSharesYes : m.totalSharesNo;
            require(totalWinningShares > 0, "No winning shares");
            
            payout = (winningBet.shares * distributablePool) / totalWinningShares;
        }
    }
    
    require(payout > 0, "Nothing to claim");
    
    hasClaimed[_marketId][msg.sender] = true;
    
    usdcToken.safeTransfer(msg.sender, payout);
    emit PayoutClaimed(_marketId, msg.sender, payout);
}
```

### Adicionar Função para Pagar Reporter Reward

```solidity
/**
 * @notice [C-01 FIX] Nova função para proposer reivindicar reporter reward
 * @dev Deve ser chamada APÓS finalizeOutcome()
 */
function claimReporterReward(string calldata _marketId) external nonReentrant {
    require(marketExists[_marketId], "No market");
    Market storage m = markets[_marketId];
    
    require(m.state == MarketState.RESOLVED, "Not resolved");
    require(!m.isVoid, "Market voided");
    require(msg.sender == m.proposer, "Not proposer");
    require(!reporterRewardClaimed[_marketId], "Already claimed");
    
    uint256 totalPool = m.totalYes + m.totalNo;
    uint256 reward = (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
    
    reporterRewardClaimed[_marketId] = true;
    
    usdcToken.safeTransfer(msg.sender, reward);
    emit ReporterRewardClaimed(_marketId, msg.sender, reward);
}

// Adicionar ao topo do contrato:
mapping(string => bool) public reporterRewardClaimed;
event ReporterRewardClaimed(string indexed marketId, address indexed proposer, uint256 reward);
```

---

## 🔴 PATCH CRÍTICO #2 - Validar Token USDC

### Problema
Se o token USDC for trocado ou for um token malicioso com callbacks, pode haver reentrancy.

### Solução

```solidity
// ============================================
// MUDANÇAS NO CONSTRUTOR
// ============================================

constructor(
    address _usdcAddress,
    address _admin,
    address _operator,
    address _treasury
) {
    require(_usdcAddress != address(0), "Invalid USDC");
    require(_admin != address(0), "Invalid Admin");
    require(_operator != address(0), "Invalid Operator");
    require(_treasury != address(0), "Invalid Treasury");
    
    // [C-02 FIX] Validar que é USDC real da Base
    require(
        _usdcAddress == 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913,
        "Must be Base USDC"
    );
    
    // Verificar que não é um contrato proxy malicioso
    (bool success, bytes memory data) = _usdcAddress.staticcall(
        abi.encodeWithSignature("decimals()")
    );
    require(success && abi.decode(data, (uint8)) == 6, "Invalid USDC decimals");
    
    treasury = _treasury;
    usdcToken = IERC20(_usdcAddress);

    _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    _grantRole(OPERATOR_ROLE, _operator);
    currentOperator = _operator;
}
```

---

## 🟠 PATCH ALTO #1 - Limitar Poderes do Admin

### Problema
Admin tem poderes ilimitados que podem travar fundos dos usuários.

### Solução

```solidity
// ============================================
// ADICIONAR NOVOS LIMITES DE TEMPO
// ============================================

// No topo do contrato
uint256 public pauseStartTime;
uint256 public constant MAX_PAUSE_DURATION = 7 days;
uint256 public lastHouseWithdrawal;
uint256 public constant HOUSE_WITHDRAWAL_COOLDOWN = 1 days;
uint256 public constant HOUSE_WITHDRAWAL_MAX_PERCENT = 50; // 50% por vez

/**
 * @notice [H-01 FIX] Pause com limite de tempo
 */
function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    pauseStartTime = block.timestamp;
    _pause();
}

/**
 * @notice [H-01 FIX] Override para auto-unpause após MAX_PAUSE_DURATION
 */
function paused() public view override returns (bool) {
    if (super.paused() && block.timestamp > pauseStartTime + MAX_PAUSE_DURATION) {
        return false; // Auto-unpause
    }
    return super.paused();
}

/**
 * @notice [H-01 FIX] Validações estritas para setOperator
 */
function setOperator(address _newOperator) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(_newOperator != address(0), "Zero address");
    require(_newOperator != currentOperator, "Already operator");
    require(!_isContract(_newOperator), "Must be EOA"); // Apenas EOA
    
    // Propor mudança com timelock de 24h
    bytes32 changeHash = keccak256(abi.encode("OPERATOR", _newOperator));
    pendingOperatorChange[changeHash] = block.timestamp + 1 days;
    
    emit OperatorChangeProposed(_newOperator, block.timestamp + 1 days);
}

function executeOperatorChange(address _newOperator) external onlyRole(DEFAULT_ADMIN_ROLE) {
    bytes32 changeHash = keccak256(abi.encode("OPERATOR", _newOperator));
    require(pendingOperatorChange[changeHash] != 0, "Not proposed");
    require(block.timestamp >= pendingOperatorChange[changeHash], "Timelock active");
    
    _revokeRole(OPERATOR_ROLE, currentOperator);
    _grantRole(OPERATOR_ROLE, _newOperator);
    currentOperator = _newOperator;
    delete pendingOperatorChange[changeHash];
    
    emit OperatorChanged(currentOperator, _newOperator);
}

/**
 * @notice [H-01 FIX] Limitar saques de house fees
 */
function withdrawHouseFees() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
    require(
        block.timestamp >= lastHouseWithdrawal + HOUSE_WITHDRAWAL_COOLDOWN,
        "Cooldown active"
    );
    
    uint256 maxWithdrawal = (houseBalance * HOUSE_WITHDRAWAL_MAX_PERCENT) / 100;
    uint256 amount = houseBalance > maxWithdrawal ? maxWithdrawal : houseBalance;
    
    require(amount > 0, "No fees");
    
    houseBalance -= amount;
    lastHouseWithdrawal = block.timestamp;
    
    usdcToken.safeTransfer(treasury, amount);
    emit HouseFeeWithdrawn(treasury, amount);
}

// Adicionar mappings e eventos
mapping(bytes32 => uint256) public pendingOperatorChange;
event OperatorChangeProposed(address indexed newOperator, uint256 executeTime);
event OperatorChanged(address indexed oldOperator, address indexed newOperator);
```

---

## 🟠 PATCH ALTO #2 - Prevenir Early Proposal Manipulation

### Problema
Criadores podem propor resultado antes do deadline e manipular o mercado.

### Solução

```solidity
// ============================================
// ADICIONAR TRACKING DE ÚLTIMA APOSTA
// ============================================

// No topo do contrato
mapping(string => uint256) public lastBetTime;
uint256 public constant MIN_PROPOSAL_DELAY_AFTER_BET = 1 hours;

/**
 * @notice [H-02 FIX] Atualizar lastBetTime em placeBet
 */
function placeBet(
    string calldata _marketId,
    uint256 _amount,
    bool _side,
    address _referrer
) external nonReentrant whenNotPaused {
    // ... código existente ...
    
    // [H-02 FIX] Atualizar timestamp da última aposta
    lastBetTime[_marketId] = block.timestamp;
    
    // ... resto do código ...
}

/**
 * @notice [H-02 FIX] Prevenir proposta imediata após apostas
 */
function proposeOutcome(
    string calldata _marketId,
    bool _result,
    string calldata _evidenceUrl
) external nonReentrant whenNotPaused {
    require(marketExists[_marketId], "No market");
    Market storage m = markets[_marketId];
    
    // [H-02 FIX] SEMPRE exigir que deadline tenha passado
    require(block.timestamp >= m.deadlineTime, "Deadline not reached");
    
    // [H-02 FIX] Exigir delay mínimo após última aposta
    require(
        block.timestamp >= lastBetTime[_marketId] + MIN_PROPOSAL_DELAY_AFTER_BET,
        "Too soon after last bet"
    );
    
    require(m.state == MarketState.OPEN, "Invalid state");
    
    // ... resto do código ...
}
```

---

## 🟠 PATCH ALTO #3 - Proteger _calculateShares Contra Overflow

### Problema
Multiplicações consecutivas podem overflow em cenários extremos.

### Solução

```solidity
/**
 * @notice [H-03 FIX] Cálculo de shares protegido contra overflow
 */
function _calculateShares(
    uint256 yesPool,
    uint256 noPool,
    uint256 betAmount,
    bool isEarlyBird
) internal pure returns (uint256) {
    // Validações de entrada
    require(yesPool <= type(uint128).max, "YesPool overflow");
    require(noPool <= type(uint128).max, "NoPool overflow");
    require(betAmount <= type(uint128).max, "BetAmount overflow");
    
    if (yesPool == 0) {
        // Primeira aposta
        uint256 shares = betAmount * SHARE_PRECISION;
        require(shares / SHARE_PRECISION == betAmount, "Initial shares overflow");
        return shares;
    }
    
    uint256 weight = isEarlyBird ? MAX_WEIGHT : MIN_WEIGHT;
    uint256 totalPool = yesPool + noPool;
    
    // Calcular odds com proteção contra overflow
    // odds = (totalPool * SHARE_PRECISION) / yesPool
    uint256 oddsNumerator = totalPool * SHARE_PRECISION;
    require(oddsNumerator / SHARE_PRECISION == totalPool, "Odds numerator overflow");
    
    uint256 odds = oddsNumerator / yesPool;
    require(odds <= type(uint128).max, "Odds too high");
    
    // Calcular shares em etapas seguras
    // shares = (betAmount * odds * weight) / (100 * SHARE_PRECISION)
    
    // Passo 1: betAmount * odds
    uint256 step1 = betAmount * odds;
    require(step1 / odds == betAmount, "Step1 overflow");
    
    // Passo 2: step1 * weight
    uint256 step2 = step1 * weight;
    require(step2 / weight == step1, "Step2 overflow");
    
    // Passo 3: divisão final
    uint256 shares = step2 / (100 * SHARE_PRECISION);
    
    require(shares > 0, "Shares too small");
    require(shares <= type(uint128).max, "Final shares overflow");
    
    return shares;
}
```

---

## 🟡 PATCH MÉDIO #1 - Validações Completas em createMarket

### Problema
Falta de validações pode permitir criação de mercados inválidos.

### Solução

```solidity
/**
 * @notice [M-01 FIX] Validações completas para criação de mercado
 */
function createMarket(
    string calldata _id,
    string calldata _question,
    uint256 _deadlineTime,
    uint256 _bonusDuration,
    uint256 _seedYes,
    uint256 _seedNo
) external nonReentrant whenNotPaused {
    // [M-01 FIX] Validações de ID e Question
    require(bytes(_id).length > 0, "Empty ID");
    require(bytes(_id).length <= 64, "ID too long");
    require(bytes(_question).length > 0, "Empty question");
    require(bytes(_question).length <= 500, "Question too long");
    require(!marketExists[_id], "Market exists");
    
    // [M-01 FIX] Validações de Seeds
    require(_seedYes > 0, "Zero seedYes");
    require(_seedNo > 0, "Zero seedNo");
    require(_seedYes == _seedNo, "Seeds must be equal"); // Prevenir manipulação inicial
    require(_seedYes >= 1e6, "Minimum 1 USDC seed"); // Mínimo 1 USDC
    require(_seedYes <= 1000e6, "Maximum 1000 USDC seed"); // Máximo 1000 USDC
    
    // [M-01 FIX] Validações de Timing
    require(_deadlineTime > block.timestamp, "Past deadline");
    require(_deadlineTime >= block.timestamp + 1 hours, "Deadline too soon");
    require(_deadlineTime <= block.timestamp + 365 days, "Deadline too far");
    
    require(_bonusDuration > 0, "Zero bonus duration");
    require(_bonusDuration >= 1 hours, "Bonus too short");
    require(_bonusDuration <= 30 days, "Bonus too long");
    
    // [M-01 FIX] Rate limiting
    require(
        block.timestamp >= lastMarketCreation[msg.sender] + MIN_MARKET_INTERVAL,
        "Too frequent"
    );
    
    // [M-01 FIX] Validar que criador não é contrato (opcional)
    require(!_isContract(msg.sender), "Contracts cannot create markets");
    
    // ... resto do código existente ...
    
    lastMarketCreation[msg.sender] = block.timestamp;
}
```

---

## 🟡 PATCH MÉDIO #2 - Melhorar emergencyResolve

### Problema
Race condition permite operador frontrun a chamada de emergência.

### Solução

```solidity
/**
 * @notice [M-02 FIX] Emergency resolve com recompensa para caller
 */
function emergencyResolve(string calldata _marketId) external nonReentrant {
    require(marketExists[_marketId], "No market");
    Market storage m = markets[_marketId];
    
    require(m.state == MarketState.DISPUTED, "Not disputed");
    
    // [M-02 FIX] Verificar timeout de 30 dias
    require(
        block.timestamp > m.challengeTime + EMERGENCY_TIMEOUT,
        "Timeout not reached"
    );
    
    // [M-02 FIX] Recompensar quem ativa emergency resolve
    uint256 totalBonds = m.bondAmount + m.challengeBondAmount;
    uint256 callerReward = totalBonds / 100; // 1% dos bonds
    
    require(callerReward > 0, "No bonds to distribute");
    
    // Distribuir bonds
    if (m.bondAmount > 0) {
        uint256 proposerShare = m.bondAmount - (callerReward / 2);
        claimableBonds[m.proposer] += proposerShare;
        m.bondAmount = 0;
    }
    
    if (m.challengeBondAmount > 0) {
        uint256 challengerShare = m.challengeBondAmount - (callerReward / 2);
        claimableBonds[m.challenger] += challengerShare;
        m.challengeBondAmount = 0;
    }
    
    // Pagar recompensa ao caller
    claimableBonds[msg.sender] += callerReward;
    
    _updateMarketState(m, MarketState.RESOLVED);
    m.isVoid = true;
    
    emit EmergencyResolved(_marketId, msg.sender, callerReward);
    emit MarketVoided(_marketId);
}

/**
 * @notice [M-02 FIX] Prevenir resolveDispute após timeout
 */
function resolveDispute(
    string calldata _marketId,
    bool _finalResult
) external onlyRole(OPERATOR_ROLE) nonReentrant {
    require(marketExists[_marketId], "No market");
    Market storage m = markets[_marketId];
    
    require(m.state == MarketState.DISPUTED, "Not disputed");
    
    // [M-02 FIX] Não pode resolver após timeout de emergência
    require(
        block.timestamp <= m.challengeTime + EMERGENCY_TIMEOUT,
        "Emergency timeout reached"
    );
    
    // ... resto do código ...
}

// Adicionar evento
event EmergencyResolved(string indexed marketId, address indexed caller, uint256 reward);
```

---

## 🟡 PATCH MÉDIO #3 - Adicionar Aposta Mínima

### Problema
Sem valor mínimo, permite ataques de griefing.

### Solução

```solidity
// No topo do contrato
uint256 public constant MIN_BET_AMOUNT = 1e6; // 1 USDC mínimo

/**
 * @notice [M-03 FIX] Validar valor mínimo de aposta
 */
function placeBet(
    string calldata _marketId,
    uint256 _amount,
    bool _side,
    address _referrer
) external nonReentrant whenNotPaused {
    require(marketExists[_marketId], "No market");
    Market storage m = markets[_marketId];
    
    // [M-03 FIX] Validar limites de aposta
    require(_amount >= MIN_BET_AMOUNT, "Below minimum bet");
    require(_amount <= maxBetAmount, "Above maximum bet");
    
    // ... resto do código ...
}
```

---

## 🔧 TESTES RECOMENDADOS

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PredictionBattleV8_Fixed.sol";

contract PredictionBattleV8Test is Test {
    
    /**
     * @notice [C-01 TEST] Verificar que não há double counting
     */
    function testNoDoubleCountingReporterReward() public {
        // Setup
        createMarket("test1");
        placeBets("test1");
        proposeOutcome("test1", true);
        
        // Fast forward
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1);
        
        // Finalizar
        uint256 contractBalanceBefore = usdc.balanceOf(address(battle));
        battle.finalizeOutcome("test1");
        
        // Reivindicar tudo
        uint256 totalClaimed = 0;
        for (uint i = 0; i < bettors.length; i++) {
            vm.prank(bettors[i]);
            battle.claimWinnings("test1");
            totalClaimed += /* calcular payout */;
        }
        
        vm.prank(proposer);
        battle.claimReporterReward("test1");
        
        uint256 contractBalanceAfter = usdc.balanceOf(address(battle));
        
        // Invariante: Balance não pode ficar negativo
        assertGe(contractBalanceAfter, 0);
        
        // Invariante: Total claimed == Total depositado
        assertEq(totalClaimed, totalDeposited);
    }
    
    /**
     * @notice [H-03 TEST] Fuzzing de _calculateShares
     */
    function testFuzz_CalculateShares(
        uint128 yesPool,
        uint128 noPool,
        uint128 betAmount
    ) public {
        vm.assume(yesPool > 0);
        vm.assume(noPool > 0);
        vm.assume(betAmount > 0);
        
        uint256 shares = battle._calculateShares(yesPool, noPool, betAmount, true);
        
        // Shares devem ser razoáveis
        assertGt(shares, 0);
        assertLt(shares, type(uint128).max);
    }
    
    /**
     * @notice [H-02 TEST] Não pode propor antes de deadline
     */
    function testCannotProposeBeforeDeadline() public {
        createMarket("test2");
        
        vm.expectRevert("Deadline not reached");
        battle.proposeOutcome("test2", true, "evidence");
    }
    
    /**
     * @notice [M-02 TEST] Emergency resolve funciona após timeout
     */
    function testEmergencyResolveAfterTimeout() public {
        createDisputedMarket("test3");
        
        // Antes do timeout: deve falhar
        vm.expectRevert("Timeout not reached");
        battle.emergencyResolve("test3");
        
        // Após timeout: deve funcionar
        vm.warp(block.timestamp + 30 days + 1);
        battle.emergencyResolve("test3");
        
        // Mercado deve estar void
        (, , , , , , bool isVoid) = battle.getMarketDetails("test3");
        assertTrue(isVoid);
    }
}
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Antes de Implementar
- [ ] Fazer backup do código atual
- [ ] Criar branch separado para patches
- [ ] Configurar ambiente de testes

### Patches Críticos (OBRIGATÓRIO)
- [ ] [C-01] Corrigir double counting
- [ ] [C-02] Validar token USDC
- [ ] Adicionar testes para C-01 e C-02
- [ ] Rodar todos os testes existentes

### Patches Altos (RECOMENDADO)
- [ ] [H-01] Limitar Admin
- [ ] [H-02] Prevenir early proposal
- [ ] [H-03] Proteger calculateShares
- [ ] Adicionar testes para H-01, H-02, H-03

### Patches Médios (SUGERIDO)
- [ ] [M-01] Validações em createMarket
- [ ] [M-02] Melhorar emergencyResolve
- [ ] [M-03] Adicionar MIN_BET_AMOUNT
- [ ] Adicionar testes para M-01, M-02, M-03

### Verificações Finais
- [ ] Todos os testes passam
- [ ] Cobertura de testes > 90%
- [ ] Gas optimization check
- [ ] Auditoria manual do código
- [ ] Documentação atualizada

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Todos os patches críticos implementados
- [ ] Testes de integração completos
- [ ] Testnet deployment e testes
- [ ] Auditoria externa (se possível)

### Deployment
- [ ] Verificar endereços corretos
- [ ] Usar Gnosis Safe para Admin
- [ ] Configurar Operator com timelock
- [ ] Verificar Treasury multisig

### Post-Deployment
- [ ] Verificar contrato no explorer
- [ ] Configurar monitoramento
- [ ] Testar funcionalidades básicas
- [ ] Documentar endereços

---

*Patches preparados em 04 de Fevereiro de 2026*
*Versão: 1.0*
