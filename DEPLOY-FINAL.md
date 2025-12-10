# 🚀 Guia de Deploy Vercel (FINAL + REDIS)

Este guia cobre o deploy da versão atual com **Painel Admin**, **Testnet** e **Banco de Dados Real**.

---

## ⚙️ Passo 1: Criar Banco de Dados (NOVO!)

Para que as apostas não sumam, precisamos de um banco de dados. O Vercel oferece um grátis.

1. No painel do seu projeto no Vercel, clique na aba **Storage**.
2. Clique em **Creates Database** (ou Connect Database).
3. Escolha **KV** (Redis).
4. Dê o nome `prediction-db` e clique em **Create**.
5. Em "Environment Variables", certifique-se que está marcado para adicionar automaticamente ao projeto (geralmente é automático).
   - Isso vai adicionar variáveis como `KV_URL`, `KV_REST_API_URL`, etc.

---

## 📋 Passo 2: Atualizar Código no Vercel

Se você já tinha o projeto no Vercel, apenas vá em **Deployments** e certifique-se que o último commit ("Migrate from in-memory store...") foi deployado. Se não, clique em Redeploy.

---

## 🔑 Passo 3: Variáveis de Ambiente (Revisão)

Certifique-se que você tem estas 5 variáveis em **Settings > Environment Variables**:

| Nome da Variável | Valor |
|------------------|-------|
| `NEYNAR_API_KEY` | `D4D3...` |
| `RECEIVER_ADDRESS` | `0x2Cd...` |
| `NEXT_PUBLIC_ADMIN_ADDRESS` | `0xFbb...` (Seu endereço Testnet) |
| `NEXT_PUBLIC_USE_MAINNET` | `false` |
| `NEXT_PUBLIC_ONCHAINKIT_API_KEY` | `eMK4P...` (Sua chave Coinbase) |

> **Nota:** As variáveis do banco (`KV_...`) devem aparecer automaticamente após o Passo 1.

---

## 🧪 Passo 4: Verificar Testnet no Vercel

1. **Acessar Admin:** `seu-app.vercel.app/admin`
2. **Criar Aposta:** Crie uma nova aposta teste.
3. **Verificar Home:** Vá para a página inicial.
   - A aposta DEVE aparecer agora!
   - E vai continuar lá mesmo se você recarregar.

---

**Tudo pronto! Boa sorte! 🚀**
