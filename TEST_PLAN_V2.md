# Plano de Teste Completo: V2 Migration

Este documento guia você através do teste "End-to-End" para garantir que a migração para os contratos V2 foi bem sucedida.

## Pré-requisitos
- Carteira com ETH (Base Sepolia) e USDC (Base Sepolia).
- Acesso à conta Admin (endereço definido no `.env`).

---

## 🚀 Fase 1: Criação e Aposta

1.  **Criar Nova Batalha**
    - Vá para `/create` (ou `/admin/create`).
    - Crie uma batalha simples (Ex: "Will BTC hit 100k?").
    - **Verificação**: Confirme a transação na Metamask. Deve chamar a função `createMarket` (não `createPrediction`).
    - **Resultado**: A batalha deve aparecer na "Arena" (`/`).

2.  **Fazer Apostas**
    - **Aposta A (Vencedor Planejado)**:
        - Conecte Wallet A.
        - Aposte 1.0 USDC no **YES**.
        - Confirme Approve e PlaceBet.
    - **Aposta B (Perdedor)**:
        - Conecte Wallet B (ou a mesma).
        - Aposte 1.0 USDC no **NO**.
    - **Verificação**: O pote deve mostrar $2.00 (aprox).

---

## ⚖️ Fase 2: Resolução (Admin)

1.  **Resolver Mercado**
    - Vá para `/admin` (Dashboard).
    - Encontre a batalha criada.
    - Clique em **"Resolve YES"**.
    - **Verificação**: Confirme a transação `resolveMarket` na blockchain.
    - **Observe**: O status da carta no Admin deve mudar para "RESOLVED / YES".

---

## 💰 Fase 3: Reivindicação (Claim) - **CRÍTICO**

*Esta é a maior mudança da V2. Não há mais distribuição automática.*

1.  **Verificar Botão de Claim**
    - Volte para a página da batalha ou Admin com a **Wallet A** (Vencedora) conectada.
    - O botão que antes mostrava status agora deve ser um botão **VERDE** pulsante: **"💰 CLAIM WINNINGS"**.
    - *Nota: Se você estiver com a Wallet B (Perdedora), o botão deve mostrar "🚫 BATTLE RESOLVED" (cinza).*

2.  **Executar Claim**
    - Clique em "CLAIM WINNINGS".
    - Confirme a transação `claimReward`.
    - **Sucesso**:
        - Você deve receber os USDC na carteira.
        - O botão deve mudar para **"✅ REWARD CLAIMED"**.

---

## 📊 Fase 4: Monitoramento Admin

1.  **Painel de Pagamentos**
    - Vá para `/admin/payouts`.
    - Na aba **Pending Claims**, você deve ver a aposta listada.
    - Se você já fez o claim no passo anterior, clique em **"Refresh Data"**.
    - O usuário que fez claim deve aparecer com um ✅ verde e "CLAIMED". e a aposta pode ter sumido da lista "Pending" se todos tiverem recebido.
    - Verifique a aba **Fully Claimed**.

2.  **Teste de Sincronia (Opcional)**
    - Se o banco de dados não atualizou sozinho (ex: erro de rede após claim), clique no botão pequeno de **"Refresh" (🔄)** ao lado do nome do usuário na lista.
    - Isso consultará o contrato diretamente na blockchain para validar o pagamento.

---

## ✅ Conclusão

Se todos os passos acima funcionarem, o sistema está 100% operacional na V2.
