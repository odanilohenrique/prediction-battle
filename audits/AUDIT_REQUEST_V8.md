# 🛡️ Solicitação de Auditoria de Segurança: PredictionBattleV8

**Data:** 06 de Fevereiro de 2026
**Contrato:** PredictionBattleV8.sol
**Endereço na Testnet (Base Sepolia):** `0xbB2a28A27dDef4e01Ee77c407E298523De3F5f6A`

---

## 1. Visão Geral
Este documento descreve as alterações e decisões de design implementadas na versão **V8** do contrato *Prediction Battle*, em preparação para o lançamento na **Base Mainnet**. Solicitamos uma auditoria focada nas novas funcionalidades e correções de segurança.

## 2. Alterações Críticas (Desde V7)

As seguintes correções foram aplicadas para mitigar riscos identificados em auditorias anteriores:

1.  **Solvência (Correção C-01):**
    - O mecanismo de recompensa do reporter (1%) foi separado do pool de pagamentos.
    - Implementada função `claimReporterReward()` para que o proponente retire sua recompensa separadamente, garantindo que `claimWinnings()` sempre tenha fundos suficientes para os apostadores.
    - Adicionado mapping `reporterRewardClaimed` para evitar saques duplos.

2.  **Mercados Abandonados (Novo Recurso):**
    - Adicionada função `voidAbandonedMarket(marketId)`.
    - Permite que **qualquer usuário** anule um mercado se ele permanecer sem proposta por **30 dias após o deadline**.
    - Isso previne fundos travados indefinidamente em mercados esquecidos.

3.  **Observabilidade:**
    - Novos eventos adicionados: `CreatorFeesWithdrawn`, `ReferrerFeesWithdrawn`, `MarketVoided`.

4.  **Proteção contra Slippage:**
    - Função `placeBet` agora exige parâmetro `_minSharesOut` para proteger usuários contra manipulação de preço por MEV/Sandwich attacks.

---

## 3. Decisões de Design Específicas ⚠️

### 3.1. Verificação Antecipada (Early Verification)
**IMPORTANTE:** O contrato permite intencionalmente que `proposeOutcome()` seja chamado **ANTES** do `deadlineTime` do mercado.

*   **Lógica:** Permitimos que a comunidade proponha o resultado assim que o evento ocorrer, mesmo que o prazo oficial do mercado não tenha expirado.
*   **Justificativa:** Muitos eventos (ex: "Post vai bater 100 likes em 24h") podem ser resolvidos em 1 hora. Não queremos travar o pagamento por mais 23 horas desnecessariamente.
*   **Segurança:** A janela de disputa de 12 horas (`DISPUTE_WINDOW`) começa a contar a partir do momento da proposta. Se a proposta for prematura ou falsa, ela pode ser disputada normalmente.

### 3.2. Centralização Temporária (Operator)
*   As funções `resolveDispute` e `voidMarket` são controladas pelo role `OPERATOR_ROLE`. Isso é uma medida de segurança temporária para a fase inicial (guarded launch).

---

## 4. Escopo da Auditoria

Solicitamos foco nas seguintes áreas:

1.  **Integridade Financeira:** Verificar se a separação de `claimReporterReward` e `claimWinnings` garante matematicamente a solvência do contrato em todos os cenários (vitória Yes, vitória No, Void).
2.  **Lógica de Estados:** Confirmar se a função `voidAbandonedMarket` não pode ser abusada para anular mercados válidos antes do prazo de 30 dias.
3.  **Segurança da Verificação Antecipada:** Validar se a permissão de proposta antes do deadline introduz vetores de ataque não mitigados pela janela de disputa.

---

## 5. Informações Técnicas

*   **Compiler:** Solidity ^0.8.20
*   **Dependências:** OpenZeppelin (AccessControl, ReentrancyGuard, SafeERC20, Pausable)
*   **Token:** USDC (Nativo na Base)

---

**Equipe Prediction Battle**
