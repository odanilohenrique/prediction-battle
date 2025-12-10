# 🚀 Guia de Deploy Vercel (FINAL)

Este guia cobre o deploy da versão atual com **Painel Admin** e **Testnet Base Sepolia**.

---

## 📋 Passo 1: Atualizar GitHub

(Eu já fiz isso para você, mas aqui está o comando se precisar)
```bash
git push origin main
```

---

## ⚙️ Passo 2: Configurar no Vercel

1. **Acesse:** [https://vercel.com/new](https://vercel.com/new)
2. **Importe:** O repositório `prediction-battle`
3. **Framework Preset:** Next.js (automático)
4. **Environment Variables:** (IMPORTANTE!)

Você PRECISA adicionar estas 5 variáveis nas configurações do Vercel:

| Nome da Variável | Valor | Descrição |
|------------------|-------|-----------|
| `NEYNAR_API_KEY` | `D4D3...CC5B2CEA5FC7` | Sua chave Neynar |
| `RECEIVER_ADDRESS` | `0x2Cd...B66b4` | Sua carteira mainnet (para taxas) |
| `NEXT_PUBLIC_ADMIN_ADDRESS` | `0xFbb...cE987` | **Sua carteira testnet (para acesso admin)** |
| `NEXT_PUBLIC_USE_MAINNET` | `false` | **Define modo testnet (zero risco)** |
| `NEXT_PUBLIC_URL` | *(Deixe em branco por enquanto)* | Atualize depois com a URL final |

> **Dica:** Copie exatamente os valores que estão no seu `.env.local`.

---

## 🚀 Passo 3: Deploy

1. Click em **Deploy**.
2. Aguarde ~1-2 minutos.
3. **Sucesso!** O app estará online.

---

## 🧪 Passo 4: Verificar Testnet no Vercel

1. Acesse a URL do seu app (ex: `https://prediction-battle.vercel.app`)
2. Tente conectar sua wallet no botão do topo.
   - Deve pedir rede **Base Sepolia**.
3. Acesse `/admin`:
   - Deve pedir para conectar a carteira `0xFbb...cE987`.
   - Se funcionar, você verá o dashboard!

---

## 🐛 Problemas Comuns

**Erro de Build "Payment Required" no Neynar:**
- Às vezes o build do Next.js tenta acessar a API. Se falhar, ignore por enquanto, pois em runtime vai funcionar com a chave correta.

**"Acesso Negado" no Admin:**
- Verifique se copiou o endereço `0xFbb...cE987` EXATAMENTE igual nas variáveis do Vercel.
- O endereço é case-insensitive, mas por segurança copie igual.

**Wallet não conecta:**
- Certifique-se de ter rede Base Sepolia no celular/browser.
- Instale Coinbase Wallet ou MetaMask.

---

**Tudo pronto! Boa sorte! 🚀**
