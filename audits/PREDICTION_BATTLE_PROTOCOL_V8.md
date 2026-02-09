# 🦅 Prediction Battle Protocol (V8 ECR-001): Visão Técnica & Mecânica

**Versão do Documento:** 1.0
**Contrato:** PredictionBattleV8.sol
**Network:** Base (EVM)

---

## 1. Introdução

O **Prediction Battle** é um mercado de predição social descentralizado focado em métricas mensuráveis de redes sociais (ex: Farcaster, Twitter) e eventos on-chain. Diferente de mercados tradicionais, nosso foco é em micro-eventos de curta duração (ex: "Este post vai bater 100 likes em 24h?").

O protocolo permite que qualquer usuário crie mercados, aposte em resultados binários (Sim/Não) e participe da resolução dos mercados através de um mecanismo de oráculo otimista.

---

## 2. Ciclo de Vida do Mercado

O contrato opera como uma máquina de estados finita para cada mercado (`marketId`).

### 2.1. Estados do Mercado (`MarketState`)

1.  **OPEN (0):** Mercado ativo aceitando apostas.
2.  **LOCKED (1):** Mercado fechado para apostas (prazo expirou ou limite atingido), aguardando verificação.
3.  **PROPOSED (2):** Um usuário propos um resultado. Janela de disputa (12h) iniciada.
4.  **DISPUTED (3):** O resultado proposto foi contestado. Aguardando resolução por arbitragem (Admin/Operator).
5.  **RESOLVED (4):** Resultado finalizado. Pagamentos liberados.

### 2.1.1 Resultados (`MarketOutcome` - ECR-001)
- **PENDING (0):** Ainda não resolvido.
- **YES (1):** Resultado SIM venceu.
- **NO (2):** Resultado NÃO venceu.
- **DRAW (3):** Empate Técnico (ex: Jogo terminou empatado). Aplica-se taxa de serviço (20%) e devolve-se o restante.
- **CANCELLED (4):** Cancelamento Administrativo ou Abandono. Reembolso de 100%.

### 2.2. Fluxo Principal

1.  **Criação (`createMarket`):** Usuário define questão, prazos e opções. Paga taxas de rede.
2.  **Apostas (`placeBet`):** Usuários depositam USDC no pool Sim ou Não.
    *   *Nota:* O contrato retém as apostas até a resolução.
3.  **Verificação (`proposeOutcome`):**
    *   **Qualquer usuário** pode propor o resultado.
    *   Exige um **Bond (Garantia)** (Mínimo 5 USDC + 1% do Pool).
    *   **Feature Chave:** Pode ser chamado *antes* do deadline se o resultado já for óbvio (ver seção 4).
4.  **Janela de Disputa (12h):**
    *   Se ninguém contestar em 12h, o resultado é finalizado (`finalizeOutcome`).
    *   Se houver contestação (`disputeOutcome`), o mercado entra em estado `DISPUTED`.
5.  **Resolução de Disputa (`resolveDispute`):**
    *   Operador analisa evidências e decide o vencedor.
    *   Quem estava certo recebe seu Bond de volta + Bond do perdedor.

---

## 3. Economia do Protocolo (Fee-on-Resolution)
O protocolo aplica taxas apenas no momento da resolução/saque (**Fee-on-Resolution**). Isso garante que, em caso de cancelamento do mercado (`VOID`), os usuários recebam 100% de reembolso sem perdas para taxas.

### Distribuição das Taxas (Hardcoded Caps)

| Destino | Porcentagem (BPS) | Descrição |
| :--- | :--- | :--- |
| **House (Tesouraria)** | 1000 (10%) | Taxa do protocolo para manutenção e desenvolvimento. |
| **Creator (Criador)** | 500 (5%) | Incentivo para quem cria mercados virais. |
| **Referrer (Indicador)** | 500 (5%) | Incentivo para quem traz volume/usuários. |
| **Reporter (Verificador)** | 100 (1%) | Recompensa para quem propõe o resultado correto on-chain. |
| **Liquidez Vencedora** | ~79% | Distribuído proporcionalmente aos vencedores. |

*Nota:* O `REPORTER_REWARD` (1%) é deduzido do pool total. As demais taxas (20%) também são deduzidas do pool total antes de calcular a partilha dos vencedores.

### Regras de Retenção
- **Vitória (YES/NO):** Taxas (21%) deduzidas do pool total. Vencedores dividem o restante (79%).
- **Empate (DRAW):** Taxas de serviço (20%) deduzidas. Usuários recebem 80% do valor apostado de volta.
- **Cancelamento (VOID):** 0% de taxas. Reembolso integral (100%).

---

## 4. Particularidades de Design & Intenções (Para Auditores)

Abaixo listamos comportamentos que são **intencionais** e fundamentais para a UX do nosso dApp, para evitar falsos positivos durante a auditoria.

### 4.1. Verificação Antecipada (Early Verification)
**Comportamento:** A função `proposeOutcome` **NÃO** verifica se `block.timestamp >= deadline`.
**Intenção:** Permitir a resolução rápida de mercados.
**Cenário:** Um mercado "Bitcoin vai bater 100k até Sexta" é criado na Segunda. Na Terça, o BTC bate 100k.
**Justificativa:** Em vez de travar o capital dos usuários até Sexta, permitimos que alguém proponha "SIM" na Terça. A janela de disputa de 12h serve como proteção contra propostas maliciosas ou prematuras. Se o resultado não for determinístico ainda, a comunidade deve disputar.

### 4.2. Void de Mercados Abandonados
**Comportamento:** A função `voidAbandonedMarket` permite anular mercados sem proposta após 30 dias.
**Intenção:** Prevenir "fundos zumbis".
**Justificativa:** Se um mercado é impopular e ninguém se interessa em verificar o resultado (nem pelo incentivo de 1%), os fundos ficariam travados para sempre. Após 30 dias de inatividade pós-deadline, permitimos o reembolso.

### 4.3. Separação de Claims
**Comportamento:** O proponente deve chamar `claimReporterReward` separadamente de `claimWinnings`.
**Intenção:** Segurança de Solvência (C-01 Fix).
**Justificativa:** Em versões anteriores, misturar recompensas e pagamentos causava erros de arredondamento que poderiam travar o último saque. A separação garante que os cálculos sejam isolados e auditáveis individualmente.

### 4.4. Cálculo de Bond Dinâmico
**Comportamento:** O Bond não é fixo. É `MAX(5 USDC, 1% do Pool)`.
**Intenção:** Skin-in-the-game proporcional.
**Justificativa:** Para mercados pequenos (10 USDC), 5 USDC é suficiente para evitar spam. Para mercados grandes (1M USDC), 5 USDC seria irrelevante para um atacante tentar manipular o resultado. O bond escala com o risco.

### 4.5. Safety Hatches (ECR-001)
92: **Feature:** `claimFallback` e `sweepDust`.
93: **Comportamento:**
94: - `claimFallback`: Se um mercado for resolvido mas não houver vencedores (ex: Resultado YES mas ninguém apostou YES), o criador pode reivindicar o saldo restante após taxas (80%).
95: - `sweepDust`: Permite ao Admin (Deployer) varrer saldos residuais (poeira) que não pertençam a passivos de usuários (`totalLockedAmount`).
96: **Intenção:** Evitar fundos presos eternamente no contrato e garantir solvência contábil rigorosa.
97: 
98: ---

## 5. Roles & Permissões

*   **DEFAULT_ADMIN_ROLE:** Pode atualizar taxas, pausar contrato e gerenciar roles. (Atualmente: Deployer).
*   **OPERATOR_ROLE:** Pode resolver disputas e forçar voids em emergências. (Guardian Role).
*   **User (Sem Role):** Pode criar mercados, apostar, propor resultados e disputar (se pagar o Bond).

---

## 6. Riscos Conhecidos & Mitigações

1.  **Conluio Proponente/Disputante:** Se um atacante detém 100% das apostas, ele poderia propor falsamente.
    *   *Mitigação:* Operator Role pode intervir em disputas. Janela de 12h permite observação pública.
2.  **Operator Malicioso:** O operador tem poder de decidir disputas.
    *   *Mitigação:* O contrato é desenhado para ser "Optimistic". A intervenção do operador é a exceção, não a regra. Futuramente, este role será substituído por um DAO ou Kleros.

---

**Link do Repositório:** https://github.com/odanilohenrique/prediction-battle
