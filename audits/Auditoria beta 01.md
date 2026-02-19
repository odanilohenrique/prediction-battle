# Auditoria Beta 01 - Prediction Battle V10

## 1. Contexto e Visão Geral

O **Prediction Battle** é um mercado de predição viral construído na rede Base, focado em UX simplificada através de Farcaster Frames. O objetivo é permitir que qualquer usuário crie mercados, aposte em resultados binários (SIM/NÃO) e conteste resultados incorretos de forma descentralizada.

O contrato inteligente auditado é o **`PredictionBattleV10.sol`**.

### Arquitetura Principal
O sistema utiliza um padrão de **Oráculo Otimista** (Optimistic Oracle):
1.  **Criação:** Qualquer usuário cria um mercado com liquidez inicial ("Seed").
2.  **Apostas:** Usuários apostam em SIM ou NÃO durante o período de duração.
3.  **Proposta:** Após o prazo, **qualquer usuário** pode propor um resultado mediante pagamento de um Bond (garantia).
4.  **Disputa:** Abre-se uma janela de 12 horas onde **qualquer outro usuário** pode contestar a proposta pagando um Bond igual.
5.  **Resolução:**
    *   **Sem disputa:** O resultado proposto é aceito automaticamente (Optimistic Success).
    *   **Com disputa:** Um Operador ou Admin intervém para julgar quem está correto. Quem mentiu perde o Bond.

## 2. Particularidades Intencionais ("False Positives")

Abaixo estão listadas características do design que **NÃO são vulnerabilidades**, mas escolhas arquiteturais conscientes. Favor não reportar como bugs, a menos que a implementação permita exploits.

### 2.1. Proposta Descentralizada (Permissionless Proposal)
*   **Comportamento:** Qualquer endereço pode chamar `proposeOutcome` e definir o resultado do mercado.
*   **Por que não é bug:** O sistema depende de incentivos econômicos (Bond) e da janela de disputa. Se alguém propuser errado, o mercado incentiva (financeiramente) um desafiante a contestar e ganhar o Bond do mentiroso.
*   **Foco da Auditoria:** Verificar se o Bond é suficiente (`_getRequiredBond`) e se a janela de disputa (`DISPUTED_WINDOW`) é respeitada e imutável durante o processo.

### 2.2. Poder do Admin (Centralização Temporária)
*   **Comportamento:** O `DEFAULT_ADMIN_ROLE` pode forçar a resolução de qualquer mercado (`adminResolve`), reabrir mercados (`reopenMarket`) e pausar o contrato.
*   **Por que não é bug:** Durante a fase Beta, o Admin serve como "rede de segurança" contra impasses, bugs de UI ou ataques coordenados. A descentralização total virá em versões futuras (V11+).
*   **Limitação de Poder:** O Admin **NÃO POSSUI** funções para sacar fundos de usuários (rug pull). `withdrawHouseBalance` saca apenas taxas acumuladas, e `sweepDust` saca apenas o excedente de arredondamento (`balance > totalLockedAmount`).
*   **Foco da Auditoria:** Garantir que o Admin **não possa drenar fundos de usuários** arbitrariamente (apenas resolver mercados conforme as regras de payout) ou bloquear saques de mercados já resolvidos.

### 2.3. "Dead Liquidity" (Seed Recuperável)
*   **Comportamento:** O valor inicial (`seedAmount`) colocado pelo criador **NÃO** entra no cálculo de shares dos apostadores (`eligibleShares`). Ele é devolvido 100% ao criador após a resolução.
*   **Por que não é bug:** Isso incentiva a criação de mercados sem risco financeiro para o criador. O criador provê liquidez inicial apenas para "destravar" o mercado, mas não atua como contraparte (House).
*   **Foco da Auditoria:** Verificar se `withdrawSeed` só pode ser chamado pelo criador e se o `totalLockedAmount` é decrementado corretamente.

### 2.4. Early Bird Shares (Mecânica Viral)
*   **Comportamento:** Apostas feitas no início (`bonusDuration`) recebem **1.2x** mais shares (`MAX_WEIGHT`) que apostas tardias (`MIN_WEIGHT` 1.0x).
*   **Por que não é bug:** Mecânica de incentivo ("Ponzi-nomics" leve) para atrair volume cedo. Isso dilui os apostadores tardios intencionalmente.
*   **Foco da Auditoria:** Verificar a matemática de `_calculateShares` e garantir que não haja underflow/overflow ou divisões por zero que travem o payout.

### 2.5. Risco Aceito: Griefing vs MEV em Mercados Open-Ended
*   **Comportamento:** Mercados sem prazo (open-ended) possuem um cooldown de 5 minutos **apenas para o próprio apostador** (per-user check) antes de propor um resultado. Não há verificação global (`lastBetTime`) para impedir propostas no mesmo bloco se feitas por carteiras diferentes.
*   **Por que não é bug:** Foi uma decisão consciente de design remover a trava global que permitia ataques baratos de Negação de Serviço (Griefing) onde um atacante travava o mercado indefinidamente com baixo custo.
*   **Risco Residual:** Existe um risco teórico de ataque Sybil/MEV onde um atacante usa duas carteiras (A aposta, B propõe) no mesmo bloco para capturar valor. Aceitamos esse risco pois o ataque é economicamente inviável na maioria dos casos devido ao custo do Bond, risco de disputa (perda de 80% do Bond) e taxas de gás. A proteção principal é a janela de disputa (12h).

### 2.6. Modelo de Contabilidade: `totalLockedAmount` e Fees (NÃO é dessincronização)
*   **Comportamento:** `_processMarketFees()` credita fees em buckets internos (`houseBalance`, `creatorBalance`, `rewardsBalance`, `referrerPool`) mas **NÃO decrementa** `totalLockedAmount`. O decremento ocorre apenas nas funções `withdraw*()`.
*   **Por que não é bug:** As fees são movimentações **contábeis internas** — nenhum USDC sai do contrato durante `_processMarketFees`. O USDC permanece dentro do contrato até que alguém chame `withdrawHouseFees()`, `withdrawCreatorFees()`, etc. Cada função `withdraw*` decrementa `totalLockedAmount` no momento em que o USDC **realmente sai**.
*   **Prova matemática:** Para um mercado de 100 USDC: `claimWinnings(79) + withdrawHouse(10) + withdrawCreator(5) + withdrawReporter(1) + withdrawReferrer(5) = 100`. A soma de TODOS os decrementos = soma de TODOS os incrementos, **independente da ordem de saque**. Isso é válido para qualquer número de mercados simultâneos.
*   **Invariante:** `usdcToken.balanceOf(address(this)) >= totalLockedAmount` é mantido em TODAS as etapas, em qualquer ordem de saque.
*   **Foco da Auditoria:** Verificar se existe algum caminho onde USDC sai **sem** decremento de `totalLockedAmount`, ou entra **sem** incremento. Não reportar a ausência de decremento em `_processMarketFees` como bug — é o design correto.

### 2.7. Transferências Internas entre Buckets (`claimFallback`, etc.)
*   **Comportamento:** `claimFallback()` move `referrerPool` para `houseBalance` sem alterar `totalLockedAmount`. Outras funções internas também movem valores entre `houseBalance`, `creatorBalance`, `rewardsBalance` sem alterar `totalLockedAmount`.
*   **Por que não é bug:** Mover USDC de um bucket interno para outro NÃO é uma saída de fundos. O USDC permanece no contrato. Alterar `totalLockedAmount` aqui causaria duplo-decremento (uma vez na transferência interna, outra no `withdraw*`), levando a **insolvência real**.
*   **Foco da Auditoria:** Garantir que cada unidade de USDC siga exatamente UM caminho de decremento: `entrada → bucket interno → withdraw* (decremento) → saída`.

### 2.8. `CANCELLED` e `_processMarketFees`
*   **Comportamento:** As funções `emergencyResolve()`, `voidMarket()` e `voidAbandonedMarket()` chamam `_processMarketFees()` após definir o outcome como `CANCELLED`.
*   **Design:** Para `CANCELLED`, `_processMarketFees` apenas faz `m.netDistributable = totalPool` e retorna — **nenhuma fee é cobrada**. O branch `CANCELLED` em `claimWinnings` usa `yesBet.amount + noBet.amount` diretamente (refund completo).
*   **Foco da Auditoria:** Verificar que o branch `CANCELLED` em `claimWinnings` **NUNCA** dependa de `netDistributable`. Se algum refator futuro mudar isso, a chamada a `_processMarketFees` já garante que `netDistributable` estará corretamente preenchido.

## 3. Escopo Crítico para Auditoria

Solicitamos foco total e agressivo nos seguintes pontos de falha. **Tente quebrar o contrato.**

### 3.1. Solvência e Travamento de Fundos (PRIORIDADE MÁXIMA)
O contrato rastreia passivos globais através da variável `totalLockedAmount`.
*   **Risco:** Se `totalLockedAmount` dessincronizar do saldo real de USDC (`usdcToken.balanceOf(address(this))`), o contrato pode ficar insolvente ou travar saques legítimos?
*   **Teste Específico:** Tente encontrar caminhos onde fundos entram (via `transferFrom`) sem incrementar `totalLockedAmount`, ou fundos saem (via `transfer`) sem decrementar `totalLockedAmount`.
*   **Cenário de Risco:** Reentrância em `claimWinnings` ou `withdrawSeed` permitindo saque duplo.

### 3.2. Erros Matemáticos e Arredondamento
O cálculo de shares e payouts envolve divisões inteiras.
*   **Risco:** Acúmulo de "poeira" (dust) que fica presa no contrato? O uso de `totalWinningShares > 0` (linha 609 e 846) previne divisão por zero em todos os casos?
*   **Teste Específico:** Simular mercados com apostas muito pequenas (ex: 1 wei de USDC, mas temos `MIN_BET_AMOUNT`) e muito grandes para testar precisão.
*   **Validação:** A função `sweepDust` é permissionada ao Admin e deve recolher APENAS o excedente (`balance - totalLockedAmount`). Verifique se ela pode acidentalmente roubar fundos de usuários.

### 3.3. Vetores de Ataque (Exploits)
*   **DoS (Negação de Serviço):** Um atacante pode criar milhares de micro-apostas para estourar o limite de gás do loop de `distributeWinnings` ou bloquear a resolução? (Nota: usamos "Pull Payment" via `claimWinnings`, mas `distributeWinnings` é um batch push - verifique se o batching mitiga isso).
*   **Front-Running:** O ID do mercado é determinístico (`keccak256(abi.encodePacked(msg.sender, _question, block.timestamp))`). Um operador malicioso pode prever o ID e front-runnar a criação? (Isso afetaria algo?).
*   **Griefing:** Um usuário pode bloquear a proposta de resultado apostando 1 wei a cada 29 minutos (devido ao cooldown de 30min em `proposeOutcome`)?

### 3.4. Resiliência do Estado
*   **Trava de Estado:** É possível um mercado ficar preso eternamente em `PROPOSED` ou `DISPUTED` sem resolução?
*   **Check:** O `EMERGENCY_TIMEOUT` (30 dias) e `emergencyResolve` cobrem todos os casos de abandono?

## 4. Estrutura de Taxas (Fee Logic)
Verificar se a dedução de 21% (Total) está correta e não sofre de erros de cálculo que beneficiem ou prejudiquem o contrato.
*   **House Fee:** 10%
*   **Creator Fee:** 5%
*   **Referrer Fee:** 5%
*   **Reporter Reward:** 1%

Esta lógica é aplicada no `claimWinnings`. Verifique se a soma das partes (`userFees`) nunca excede o total disponível, causando underflow.
