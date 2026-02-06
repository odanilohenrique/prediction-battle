# 🔐 RELATÓRIO DE AUDITORIA DE SEGURANÇA
## Contrato: PredictionBattleV8
### Deploy na Mainnet - Análise Final

---

**Data:** 06 de Fevereiro de 2026  
**Versão do Contrato:** V8 (651 linhas)  
**Linguagem:** Solidity ^0.8.20  
**Framework:** Hardhat  
**Rede Alvo:** Base Mainnet  
**USDC Address (Mainnet):** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

---

## ⚡ RESUMO EXECUTIVO

### Classificação Geral de Risco: **MÉDIO-ALTO** ⚠️

O contrato V8 apresenta **melhorias significativas** em relação às versões anteriores (V6.1, V7), corrigindo vulnerabilidades críticas como reentrancy e uso inadequado de ERC20. Porém, **ainda existem problemas que devem ser resolvidos antes do deploy na mainnet**.

### Estatísticas de Vulnerabilidades

| Severidade | V6.1 | V7 | V8 (Atual) |
|------------|------|----|-----------| 
| 🔴 **CRÍTICA** | 5 | 3 | **1** |
| 🟠 **ALTA** | 8 | 5 | **3** |
| 🟡 **MÉDIA** | 6 | 8 | **4** |
| 🔵 **BAIXA** | 4 | 6 | **5** |
| **TOTAL** | 23 | 22 | **13** |

### Progresso da Auditoria

✅ **Corrigido desde V6.1/V7:**
- ReentrancyGuard implementado em todas as funções críticas
- SafeERC20 em uso (safeTransferFrom, safeTransfer)
- Pausable implementado com controle de acesso
- AccessControl com separação de roles (Admin/Operator)
- Rate limiting para criação de mercados
- Limites de bettors por side (MAX_BETTORS_PER_SIDE = 10000)
- Slippage protection adicionada (_minSharesOut)
- Cool-down de 30 minutos após última aposta para propor
- Safety Hatch (emergencyResolve) após 30 dias de disputa
- Treasury timelock de 2 dias

---

## 🔴 VULNERABILIDADES CRÍTICAS

### C-01: Risco de Insolvência - Reporter Reward Duplo (CORRIGIDO NO V8 contracts/, MAS NÃO NO audits/)

**Severidade:** 🔴 CRÍTICA  
**Arquivo:** `contracts/PredictionBattleV8.sol` Lines 400-427 vs `audits/PredictionBattleV8.sol` Lines 395-423

> [!CAUTION]
> Existem DUAS versões diferentes do V8! A versão em `contracts/` tem correção diferente da versão em `audits/`.

**Diferença Crítica:**

#### Versão `contracts/PredictionBattleV8.sol` (CORRETA):
```solidity
// Line 413-426 - resolveDispute
// [C-01 FIX] Winner gets ONLY the bonds (both sides). No reward here.
// The winner becomes the new "proposer" and can claim reward via claimReporterReward().
uint256 totalBond = m.bondAmount + m.challengeBondAmount;
claimableBonds[_winnerAddress] += totalBond;

// Update proposer to winner so they can claim the reporter reward
m.proposer = _winnerAddress;
```

#### Versão `audits/PredictionBattleV8.sol` (PROBLEMA):
```solidity
// Line 408-414 - resolveDispute
uint256 totalBond = m.bondAmount + m.challengeBondAmount;
uint256 totalPool = m.totalYes + m.totalNo;

uint256 reward = (totalPool * REPORTER_REWARD_BPS) / FEE_DENOMINATOR;
totalBond += reward;  // ❌ ADICIONA REWARD AQUI

claimableBonds[_winnerAddress] += totalBond;  // ❌ E AQUI
```

**Problema:** Na versão `audits/`, o reward é adicionado ao `claimableBonds`, mas o `claimWinnings` também deduz o reward do pool. Isso significa:

1. Winner da disputa recebe reward via `withdrawBond()`
2. Vencedores das apostas recebem pool **já reduzido** pelo reward
3. Se todos sacarem, sobra **1% a menos** no contrato = **INSOLVÊNCIA**

**Impacto:**
- Se `totalPool = 1,000,000 USDC`
- `reporterReward = 10,000 USDC` (1%)
- Winner da disputa recebe: bonds + 10,000 USDC
- Vencedores recebem: (1,000,000 - 10,000) = 990,000 USDC
- **Total pago:** bonds + 1,000,000 USDC
- **Total no contrato:** bonds + 1,000,000 USDC
- **OK apenas se usar versão** `contracts/`

**Ação Requerida:**
```diff
ANTES DO DEPLOY:
1. Usar APENAS a versão em contracts/PredictionBattleV8.sol
2. NÃO usar a versão em audits/
3. Verificar que claimReporterReward() existe (linha 529-543)
4. Verificar que reporterRewardClaimed mapping existe (linha 130)
```

---

## 🟠 VULNERABILIDADES DE ALTA SEVERIDADE

### H-01: Falta de Validação de Market State em lockMarket (AUSENTE)

**Severidade:** 🟠 ALTA  
**Arquivo:** `contracts/PredictionBattleV8.sol`

**Descrição:**  
Não existe função `lockMarket()` pública. O estado LOCKED só é atingido por transição automática interna. **MAS** a função `proposeOutcome()` aceita mercados em estado OPEN **E** LOCKED (linha 340):

```solidity
// Line 340
require(m.state == MarketState.OPEN || m.state == MarketState.LOCKED, "Invalid state");
```

**Problema:**
- Mercado pode ser proposto enquanto ainda OPEN
- Não há verificação se deadline passou
- Permite propostas antes do evento terminar

**Cenário de Ataque:**
```
1. Criador faz mercado "Bitcoin will reach $100k by EOY"
2. Deadline: 31 de Dezembro
3. Atacante propõe resultado em 15 de Dezembro (antes do deadline)
4. Se não houver challenger, mercado resolve incorretamente
```

**Mitigação Existente:**
- Regra A: Creator deve esperar 24h (linha 343-345)
- Regra B: Cool-down de 30min após última aposta (linha 349)

**Recomendação:**
```solidity
// ADICIONAR na linha 341:
require(block.timestamp >= m.deadlineTime, "Market not expired yet");
```

---

### H-02: Fundos Travados em Mercado Sem Propostas

**Severidade:** 🟠 ALTA  
**Arquivo:** `contracts/PredictionBattleV8.sol`

**Descrição:**  
Se um mercado expira (passa do deadline) e ninguém propõe um resultado, os fundos ficam travados indefinidamente. Não há mecanismo para anular automaticamente mercados abandonados.

**Cenário:**
```
1. Mercado criado com pool de 100,000 USDC
2. Deadline passa
3. Ninguém propõe resultado
4. Estado fica OPEN para sempre
5. 100,000 USDC travados
```

**Impacto:**
- Fundos de usuários presos indefinidamente
- Seed do criador também preso
- Nenhuma forma de recuperação

**Recomendação:**
```solidity
// Adicionar função:
function voidAbandonedMarket(string calldata _marketId) external nonReentrant {
    Market storage m = markets[_marketId];
    require(m.state == MarketState.OPEN || m.state == MarketState.LOCKED, "Invalid state");
    
    // Permitir void após 30 dias do deadline sem proposta
    require(block.timestamp > m.deadlineTime + 30 days, "Not abandoned yet");
    
    _updateMarketState(m, MarketState.RESOLVED);
    m.isVoid = true;
    
    emit MarketVoided(_marketId);
}
```

---

### H-03: USDC Address Hardcoded (ALERTA PARA MAINNET)

**Severidade:** 🟠 ALTA  
**Arquivo:** `contracts/PredictionBattleV8.sol` Line 32

> [!WARNING]
> O contrato atual tem endereço de TESTNET hardcoded!

```solidity
// Line 32 - VERSÃO ATUAL (TESTNET)
IERC20 public constant usdcToken = IERC20(0x036CbD53842c5426634e7929541eC2318f3dCF7e); // Base Sepolia USDC
```

**Para Mainnet, usar:**
```solidity
IERC20 public constant usdcToken = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913); // Base Mainnet USDC
```

**Ação Requerida:**
```diff
ANTES DO DEPLOY NA MAINNET:
- IERC20 public constant usdcToken = IERC20(0x036CbD53842c5426634e7929541eC2318f3dCF7e);
+ IERC20 public constant usdcToken = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
```

---

## 🟡 VULNERABILIDADES DE MÉDIA SEVERIDADE

### M-01: Falta de Limite de Disputas

**Severidade:** 🟡 MÉDIA  
**Linhas:** 369-393

**Descrição:**  
Não há limite para quantas disputas podem ocorrer. Após uma disputa ser resolvida, o mercado vai para RESOLVED. Porém, o ciclo proposal→dispute→resolve pode, em teoria, ser explorado se houver bug no fluxo de estados.

**Status:** Parcialmente mitigado pela estrutura de estados. Mercado em DISPUTED só pode ir para RESOLVED.

---

### M-02: Timestamp vs Block.number

**Severidade:** 🟡 MÉDIA  
**Linhas:** 261, 293, 344, 349, 379, 440, 463

**Descrição:**  
O contrato usa `block.timestamp` para toda lógica temporal. Mineradores podem manipular timestamp em ±15 segundos.

**Impacto:**
- Manipulação de Early Bird bonus
- Manipulação do deadline exato
- Cool-down period bypass (limite de 30min)

**Mitigação:** O window de manipulação (±15s) é pequeno comparado aos períodos usados (30min, 12h, 24h, 30 dias).

---

### M-03: Centralização do Operator

**Severidade:** 🟡 MÉDIA  
**Linhas:** 400-428, 546-565

**Descrição:**  
O Operator pode:
- Resolver disputas arbitrariamente (`resolveDispute`)
- Anular qualquer mercado não resolvido (`voidMarket`)

Não há multi-sig ou timelock para ações do operator.

**Recomendação:**
```solidity
// Adicionar delay para ações do operator em mercados grandes
uint256 public constant OPERATOR_DELAY = 1 hours;

mapping(bytes32 => uint256) public pendingOperatorActions;

function proposeDisputeResolution(...) external onlyRole(OPERATOR_ROLE) {
    bytes32 actionHash = keccak256(abi.encode(_marketId, _winnerAddress, _finalResult));
    pendingOperatorActions[actionHash] = block.timestamp + OPERATOR_DELAY;
    emit ResolutionProposed(...);
}

function executeDisputeResolution(...) external onlyRole(OPERATOR_ROLE) {
    require(block.timestamp >= pendingOperatorActions[actionHash], "Delay active");
    // ... resto do código
}
```

---

### M-04: Gas Griefing em EnumerableSet

**Severidade:** 🟡 MÉDIA  
**Linhas:** 316-318

**Descrição:**  
O limite de `MAX_BETTORS_PER_SIDE = 10000` está implementado, mas iterar sobre 10000 endereços é caro. Funções view que iteram podem exceder gas limit.

**Status:** Mitigado pelo limite, mas custo de gas ainda alto.

---

## 🔵 VULNERABILIDADES DE BAIXA SEVERIDADE

### L-01: Eventos Faltando em Withdrawals

**Severidade:** 🔵 BAIXA  
**Linhas:** 590-602

```solidity
function withdrawCreatorFees() external nonReentrant {
    uint256 amount = creatorBalance[msg.sender];
    require(amount > 0, "No fees");
    creatorBalance[msg.sender] = 0;
    usdcToken.safeTransfer(msg.sender, amount);
    // ❌ SEM EVENTO!
}

function withdrawReferrerFees() external nonReentrant {
    uint256 amount = rewardsBalance[msg.sender];
    require(amount > 0, "No fees");
    rewardsBalance[msg.sender] = 0;
    usdcToken.safeTransfer(msg.sender, amount);
    // ❌ SEM EVENTO!
}
```

**Recomendação:** Adicionar eventos:
```solidity
event CreatorFeesWithdrawn(address indexed creator, uint256 amount);
event ReferrerFeesWithdrawn(address indexed referrer, uint256 amount);
```

---

### L-02: Falta de Verificação de Balance Antes de Transfer

**Severidade:** 🔵 BAIXA  
**Linhas:** 521, 542, 578, etc.

O contrato não verifica se tem saldo suficiente antes de transferir. SafeERC20 vai reverter, mas gasta gas desnecessário.

---

### L-03: Duplicate State Variables Comments

**Severidade:** 🔵 BAIXA  
**Linhas:** 24-26

```solidity
// ============ STATE VARIABLES ============

// ============ STATE VARIABLES ============  // ❌ DUPLICADO
```

---

### L-04: Constructor Não Verifica Se Treasury É Contrato

**Severidade:** 🔵 BAIXA  
**Linhas:** 158-172

Treasury pode ser EOA acidentalmente.

---

### L-05: Seed Withdrawal Só Funciona Se Void

**Severidade:** 🔵 BAIXA  
**Linhas:** 567-580

Criador só pode retirar seed se mercado for VOID. Se mercado resolver normalmente, seed vai para a pool de vencedores. Isso é design intencional, mas pode confundir criadores.

---

## 📊 ANÁLISE DE SOLVÊNCIA

### Fluxo de Fundos - Entrada

| Fonte | Destino | Rastreamento |
|-------|---------|--------------|
| Seed (createMarket) | totalYes, totalNo | ✅ |
| Aposta (placeBet) | Pool (menos fees) | ✅ |
| Bond (proposeOutcome) | bondAmount | ✅ |
| Bond (challengeOutcome) | challengeBondAmount | ✅ |

### Fluxo de Fundos - Saída

| Fonte | Destino | Rastreamento |
|-------|---------|--------------|
| Pool | Vencedores (claimWinnings) | ✅ |
| Pool | Reporter (claimReporterReward) | ✅ (apenas em contracts/) |
| Bonds | Winner da disputa | ✅ |
| houseBalance | Treasury | ✅ |
| creatorBalance | Creator | ✅ |
| rewardsBalance | Referrer | ✅ |
| Seed | Creator (se void) | ✅ |

### Verificação de Invariantes

#### Invariante 1: Pool = totalYes + totalNo
```
✅ VERIFICADO
- Fees deduzidos ANTES de adicionar ao pool (linha 288)
- netAmount = _usdcAmount - houseFee - creatorFee - referrerFee
- Pool só contém valores líquidos
```

#### Invariante 2: Solvência em Resolução Normal
```
✅ VERIFICADO (versão contracts/)
- distributablePool = totalPool - reporterReward (linha 506-507)
- reporterReward é claimado separadamente (linha 529-543)
- Total saídas = distributablePool + reporterReward = totalPool ✓
```

#### Invariante 3: Solvência em Void
```
✅ VERIFICADO
- Cada apostador recebe exatamente o que apostou (yesBet.amount + noBet.amount)
- Criador recebe seed de volta (linha 575-576)
```

#### Invariante 4: Bonds Retornados
```
✅ VERIFICADO
- Finalize: bond retornado ao proposer (linha 469)
- Dispute resolved: bonds vão para winner (linha 416)
- Emergency resolve: bonds retornados para ambos (linhas 443-450)
- Void: bonds retornados (linhas 553-560)
```

### ⚠️ Risco Identificado

> [!IMPORTANT]
> A única fonte de insolvência potencial é se usar a versão `audits/PredictionBattleV8.sol` que adiciona o reward aos bonds E deduz do pool.

---

## 📋 CHECKLIST PRÉ-MAINNET

### Crítico (Must-Have)
- [ ] Usar versão `contracts/PredictionBattleV8.sol` (NÃO `audits/`)
- [ ] Trocar USDC address para mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- [ ] Verificar que `claimReporterReward` e `reporterRewardClaimed` existem
- [ ] Testar fluxo completo de solvência

### Alta Prioridade
- [ ] Adicionar verificação de deadline em proposeOutcome
- [ ] Implementar voidAbandonedMarket ou similar
- [ ] Adicionar eventos a withdrawCreatorFees e withdrawReferrerFees

### Média Prioridade
- [ ] Considerar timelock para ações do Operator
- [ ] Remover comentário duplicado (linhas 24-26)
- [ ] Documentar que seed vai para pool se não void

### Baixa Prioridade
- [ ] Adicionar verificação de contrato para treasury
- [ ] Adicionar NatSpec completo

---

## 🧪 TESTES RECOMENDADOS

### Cenários de Solvência
```javascript
describe("Solvency Tests", () => {
  it("should remain solvent after normal resolution", async () => {
    // 1. Create market with 100 USDC seed
    // 2. Place bets: 500 USDC YES, 300 USDC NO
    // 3. Resolve as YES
    // 4. Claim all winnings
    // 5. Claim reporter reward
    // 6. Verify contract balance >= 0
  });

  it("should remain solvent after void", async () => {
    // 1. Create market
    // 2. Place bets
    // 3. Void market
    // 4. All bettors reclaim exact amounts
    // 5. Creator reclaims seed
    // 6. Verify contract balance >= 0
  });

  it("should remain solvent after disputed resolution", async () => {
    // 1. Create market
    // 2. Place bets
    // 3. Propose outcome with bond
    // 4. Challenge with bond
    // 5. Resolve dispute
    // 6. Winner claims bond
    // 7. Bettors claim winnings
    // 8. Reporter claims reward
    // 9. Verify contract balance >= 0
  });
});
```

### Cenários de Edge Case
```javascript
describe("Edge Cases", () => {
  it("should handle max bettors on both sides", async () => {
    // 10000 bettors YES + 10000 bettors NO
  });

  it("should handle max pool size", async () => {
    // 1M USDC total
  });

  it("should handle minimum bet amount", async () => {
    // 0.05 USDC bets
  });
});
```

---

## 📝 CONCLUSÃO

### Status: **APROVADO CONDICIONALMENTE** ✅⚠️

O contrato PredictionBattleV8 apresenta melhorias significativas e está **quase pronto** para mainnet. 

**Ações OBRIGATÓRIAS antes do deploy:**

1. ✅ Usar versão `contracts/PredictionBattleV8.sol`
2. ✅ Trocar USDC address para mainnet
3. ⚠️ Adicionar verificação de deadline em proposeOutcome
4. ⚠️ Implementar mecanismo para mercados abandonados

**Risco Residual:** MÉDIO
- Centralização do Operator (mitigável com multi-sig externo)
- Mercados abandonados (mitigável com função adicional)

**Recomendação Final:**
Deploy pode prosseguir após correções críticas, com monitoramento ativo das primeiras semanas de operação.

---

*Auditoria realizada em 06/02/2026*  
*Total de linhas analisadas: 651*  
*Tempo de análise: Profunda*
